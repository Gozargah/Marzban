"""Admin action history (YUKU patch).

One row per mutating panel request in `admin_audit_logs`. Two cooperating layers:

  1. AuditMiddleware supplies the universal facts for every mutating /api
     request — which admin, from which IP/user-agent, which endpoint, what
     status code came back — without touching a single endpoint signature.
  2. Endpoints that can produce an exact old -> new diff call detail() to
     enrich *the same row*, so the history shows what actually changed rather
     than just "PUT /api/user/foo".

The contextvar holds a mutable dict that is created before the request is
dispatched. Starlette copies the context for the downstream task, so a rebind
(`_ctx.set(...)`) downstream would be invisible here — detail() therefore only
ever mutates the dict in place.
"""
import logging
import re
from contextvars import ContextVar
from datetime import date, datetime
from decimal import Decimal
from enum import Enum
from typing import Any, Optional

from starlette.middleware.base import BaseHTTPMiddleware

logger = logging.getLogger("uvicorn.error")

# never persisted, whatever the endpoint hands us
SENSITIVE_KEYS = frozenset({
    "password", "new_password", "hashed_password", "old_password",
    "token", "access_token", "refresh_token", "secret", "secret_key",
    "private_key", "api_key", "jwt",
})

MAX_STR = 2000  # keep a rogue xray config from bloating a log row

_ctx: ContextVar[Optional[dict]] = ContextVar("yuku_audit_ctx", default=None)

# (method, path regex) -> (action, target_type, name of the capture group used as
# target_name). Ordered: first match wins, so specific routes precede generic
# ones (/user/{u}/reset before /user/{u}).
_ROUTES = [
    ("POST", r"^/api/admin/token/?$", "login", "admin", None),

    ("POST", r"^/api/user/(?P<t>[^/]+)/devices/\d+/revoke/?$", "device_revoke", "user", "t"),
    ("DELETE", r"^/api/user/(?P<t>[^/]+)/devices/\d+/?$", "device_delete", "user", "t"),
    ("POST", r"^/api/user/(?P<t>[^/]+)/reset/?$", "user_reset", "user", "t"),
    ("POST", r"^/api/user/(?P<t>[^/]+)/revoke_sub/?$", "user_revoke_sub", "user", "t"),
    ("POST", r"^/api/user/(?P<t>[^/]+)/active-next/?$", "user_active_next", "user", "t"),
    ("PUT", r"^/api/user/(?P<t>[^/]+)/set-owner/?$", "user_set_owner", "user", "t"),
    ("POST", r"^/api/user/(?P<t>[^/]+)/group/\d+/reset/?$", "user_group_reset", "user", "t"),
    ("PUT", r"^/api/user/(?P<t>[^/]+)/group/\d+/?$", "user_group_limit", "user", "t"),
    ("POST", r"^/api/users/reset/?$", "users_reset_all", None, None),
    ("DELETE", r"^/api/users/expired/?$", "users_delete_expired", None, None),
    ("POST", r"^/api/user/?$", "user_create", "user", None),
    ("PUT", r"^/api/user/(?P<t>[^/]+)/?$", "user_modify", "user", "t"),
    ("DELETE", r"^/api/user/(?P<t>[^/]+)/?$", "user_delete", "user", "t"),

    ("POST", r"^/api/admin/usage/reset/(?P<t>[^/]+)/?$", "admin_usage_reset", "admin", "t"),
    ("POST", r"^/api/admin/(?P<t>[^/]+)/users/disable/?$", "admin_users_disable", "admin", "t"),
    ("POST", r"^/api/admin/(?P<t>[^/]+)/users/activate/?$", "admin_users_activate", "admin", "t"),
    ("POST", r"^/api/admin/?$", "admin_create", "admin", None),
    ("PUT", r"^/api/admin/(?P<t>[^/]+)/?$", "admin_modify", "admin", "t"),
    ("DELETE", r"^/api/admin/(?P<t>[^/]+)/?$", "admin_delete", "admin", "t"),

    ("POST", r"^/api/node/?$", "node_create", "node", None),
    ("POST", r"^/api/node/(?P<t>\d+)/reconnect/?$", "node_reconnect", "node", "t"),
    ("PUT", r"^/api/node/(?P<t>\d+)/?$", "node_modify", "node", "t"),
    ("DELETE", r"^/api/node/(?P<t>\d+)/?$", "node_delete", "node", "t"),

    ("PUT", r"^/api/hosts/?$", "hosts_modify", "host", None),
    ("POST", r"^/api/core/restart/?$", "core_restart", "core", None),
    ("PUT", r"^/api/core/config/?$", "core_config", "core", None),

    ("POST", r"^/api/host-group/?$", "host_group_create", "host_group", None),
    ("PUT", r"^/api/host-group/(?P<t>\d+)/?$", "host_group_modify", "host_group", "t"),
    ("DELETE", r"^/api/host-group/(?P<t>\d+)/?$", "host_group_delete", "host_group", "t"),

    ("POST", r"^/api/user_template/?$", "template_create", "template", None),
    ("PUT", r"^/api/user_template/(?P<t>\d+)/?$", "template_modify", "template", "t"),
    ("DELETE", r"^/api/user_template/(?P<t>\d+)/?$", "template_delete", "template", "t"),

    ("PUT", r"^/api/yuku/settings/?$", "yuku_settings", "settings", None),
]

_COMPILED = [(m, re.compile(p), a, tt, g) for m, p, a, tt, g in _ROUTES]

# Actions the UI groups as "logins" (kept in one place for the filter list).
LOGIN_ACTIONS = ("login", "login_failed")

ACTIONS = tuple(sorted({a for _, _, a, _, _ in _ROUTES} | {"login_failed", "other"}))


def resolve_route(method: str, path: str) -> tuple:
    """Maps an HTTP method+path to (action, target_type, target_name)."""
    for m, rx, action, target_type, group in _COMPILED:
        if m != method:
            continue
        match = rx.match(path)
        if match:
            target_name = match.group(group) if group else None
            return action, target_type, target_name
    return "other", None, None


def get_client_ip(request) -> str:
    """Client IP, honouring X-Forwarded-For (the panel sits behind nginx)."""
    forwarded_for = request.headers.get("X-Forwarded-For")
    if forwarded_for:
        return forwarded_for.split(",")[0].strip()
    if request.client:
        return request.client.host
    return "Unknown"


def _jsonable(value: Any, depth: int = 0) -> Any:
    """Best-effort JSON-safe copy. Never raises — a log row is not worth a 500."""
    if depth > 6:
        return "<deep>"
    if value is None or isinstance(value, (bool, int, float)):
        return value
    if isinstance(value, str):
        return value if len(value) <= MAX_STR else value[:MAX_STR] + "…"
    if isinstance(value, (datetime, date)):
        return value.isoformat()
    if isinstance(value, Decimal):
        return float(value)
    if isinstance(value, Enum):
        return _jsonable(value.value, depth + 1)
    if isinstance(value, bytes):
        return f"<{len(value)} bytes>"
    if isinstance(value, dict):
        return {
            str(k): ("***" if str(k).lower() in SENSITIVE_KEYS else _jsonable(v, depth + 1))
            for k, v in value.items()
        }
    if isinstance(value, (list, tuple, set)):
        return [_jsonable(v, depth + 1) for v in list(value)[:100]]
    if hasattr(value, "model_dump"):
        try:
            return _jsonable(value.model_dump(), depth + 1)
        except Exception:
            pass
    if hasattr(value, "__dict__"):
        return _jsonable(
            {k: v for k, v in vars(value).items() if not k.startswith("_")},
            depth + 1,
        )
    return _jsonable(str(value), depth + 1)


def snapshot(obj: Any, fields: Optional[tuple] = None) -> dict:
    """JSON-safe dict of an ORM row / pydantic model, optionally field-limited."""
    data = _jsonable(obj)
    if not isinstance(data, dict):
        return {"value": data}
    if fields:
        return {k: v for k, v in data.items() if k in fields}
    return data


def diff(before: Any, after: Any) -> dict:
    """{'before': {...}, 'after': {...}} holding only the keys that changed."""
    b = snapshot(before) if not isinstance(before, dict) else _jsonable(before)
    a = snapshot(after) if not isinstance(after, dict) else _jsonable(after)
    if not isinstance(b, dict) or not isinstance(a, dict):
        return {"before": b, "after": a}
    changed_b, changed_a = {}, {}
    for key in set(b) | set(a):
        old, new = b.get(key), a.get(key)
        if old != new:
            changed_b[key] = old
            changed_a[key] = new
    return {"before": changed_b, "after": changed_a}


def current() -> Optional[dict]:
    """The audit dict of the request in flight, or None outside one."""
    return _ctx.get()


def detail(
    action: Optional[str] = None,
    target_type: Optional[str] = None,
    target_name: Optional[str] = None,
    admin_username: Optional[str] = None,
    before: Any = None,
    after: Any = None,
    details: Optional[dict] = None,
    skip: bool = False,
) -> None:
    """Enriches the current request's audit row. In-place, so it must not rebind
    the contextvar (see module docstring). Safe to call outside a request."""
    ctx = _ctx.get()
    if ctx is None:
        return
    if skip:
        ctx["skip"] = True
        return
    if action:
        ctx["action"] = action
    if target_type:
        ctx["target_type"] = target_type
    if target_name is not None:
        ctx["target_name"] = str(target_name)
    if admin_username:
        ctx["admin_username"] = admin_username
    if details:
        ctx.setdefault("details", {}).update(_jsonable(details))
    if before is not None or after is not None:
        ctx.setdefault("details", {}).update(diff(before or {}, after or {}))


def record(
    action: str,
    admin_username: Optional[str] = None,
    admin_id: Optional[int] = None,
    target_type: Optional[str] = None,
    target_name: Optional[str] = None,
    method: Optional[str] = None,
    path: Optional[str] = None,
    status_code: Optional[int] = None,
    ip: Optional[str] = None,
    user_agent: Optional[str] = None,
    details: Optional[dict] = None,
) -> None:
    """Writes one audit row in its own session. Failures are logged, not raised —
    auditing must never break the action it describes."""
    try:
        from app.db import GetDB, crud
        with GetDB() as db:
            crud.create_audit_log(
                db,
                action=action,
                admin_username=admin_username,
                admin_id=admin_id,
                target_type=target_type,
                target_name=target_name,
                method=method,
                path=path,
                status_code=status_code,
                ip=ip,
                user_agent=user_agent,
                details=details,
            )
    except Exception as exc:  # pragma: no cover - audit must stay non-fatal
        logger.warning("audit: failed to record %s: %s", action, exc)


def _admin_from_request(request) -> tuple:
    """(username, admin_id) from the bearer token, without a DB hit for the name."""
    from app.utils.jwt import get_admin_payload

    header = request.headers.get("Authorization") or ""
    if not header.lower().startswith("bearer "):
        return None, None
    payload = get_admin_payload(header.split(" ", 1)[1].strip())
    if not payload:
        return None, None
    username = payload.get("username")
    admin_id = None
    try:
        from app.db import GetDB, crud
        with GetDB() as db:
            dbadmin = crud.get_admin(db, username)
            if dbadmin:
                admin_id = dbadmin.id
    except Exception:
        pass
    return username, admin_id


class AuditMiddleware(BaseHTTPMiddleware):
    """Records every mutating /api request into admin_audit_logs."""

    METHODS = ("POST", "PUT", "DELETE", "PATCH")

    async def dispatch(self, request, call_next):
        path = request.url.path
        if request.method not in self.METHODS or not path.startswith("/api"):
            return await call_next(request)

        ctx: dict = {}
        token = _ctx.set(ctx)
        try:
            response = await call_next(request)
        finally:
            _ctx.reset(token)

        try:
            self._write(request, response, ctx)
        except Exception as exc:  # pragma: no cover
            logger.warning("audit: middleware failed for %s %s: %s", request.method, path, exc)
        return response

    def _write(self, request, response, ctx: dict) -> None:
        if ctx.get("skip"):
            return

        path = request.url.path
        action, target_type, target_name = resolve_route(request.method, path)

        username = ctx.get("admin_username")
        admin_id = ctx.get("admin_id")
        if not username:
            username, admin_id = _admin_from_request(request)

        status_code = getattr(response, "status_code", None)
        # unauthenticated 401s are noise (expired tabs polling); a failed login
        # is recorded explicitly by the endpoint, which sets admin_username
        if not username and status_code in (401, 403) and action != "login":
            return

        record(
            action=ctx.get("action") or action,
            admin_username=username,
            admin_id=admin_id,
            target_type=ctx.get("target_type") or target_type,
            target_name=ctx.get("target_name") or target_name,
            method=request.method,
            path=path[:256],
            status_code=status_code,
            ip=get_client_ip(request),
            user_agent=(request.headers.get("user-agent") or "")[:512] or None,
            details=ctx.get("details") or None,
        )

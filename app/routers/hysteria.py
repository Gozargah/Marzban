import threading
import time

from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel

from app.db import GetDB
from app.db import models as db_models
from app.models.proxy import ProxyTypes
from app.models.user import UserStatus
from config import HYSTERIA2_HOOK_TOKEN

router = APIRouter(tags=["Hysteria2"], prefix="/api")

# ---------------------------------------------------------------------------
# In-memory auth cache: password -> username
# Rebuilt from DB at most once per _CACHE_TTL seconds, so auth lookups are
# O(1) dict access regardless of user count. Handles 5 000+ users easily.
# ---------------------------------------------------------------------------
_CACHE_TTL = 5.0  # seconds between DB refreshes

_cache: dict[str, str] = {}
_cache_lock = threading.Lock()
_cache_ts: float = 0.0


def _build_cache() -> dict[str, str]:
    result: dict[str, str] = {}
    with GetDB() as db:
        rows = (
            db.query(db_models.User.username, db_models.Proxy.settings)
            .join(db_models.Proxy, db_models.User.id == db_models.Proxy.user_id)
            .filter(
                db_models.Proxy.type == ProxyTypes.HYSTERIA2,
                db_models.User.status.in_([UserStatus.active, UserStatus.on_hold]),
            )
            .all()
        )
    for username, settings in rows:
        if isinstance(settings, dict):
            pw = settings.get("password", "")
            if pw:
                result[pw] = username
    return result


def _get_cache() -> dict[str, str]:
    global _cache, _cache_ts
    now = time.monotonic()
    if now - _cache_ts < _CACHE_TTL:
        return _cache
    with _cache_lock:
        # Double-checked: another thread may have refreshed while we waited
        if now - _cache_ts < _CACHE_TTL:
            return _cache
        _cache = _build_cache()
        _cache_ts = time.monotonic()
    return _cache


def invalidate_hysteria_cache() -> None:
    """
    Call this after any user/proxy create-update-delete so the next auth
    request immediately sees the fresh state instead of waiting for TTL.
    """
    global _cache_ts
    with _cache_lock:
        _cache_ts = 0.0


# ---------------------------------------------------------------------------
# Request / response models
# ---------------------------------------------------------------------------

class HysteriaAuthRequest(BaseModel):
    addr: str = ""
    auth: str = ""
    recv: int = 0
    send: int = 0


class HysteriaAuthResponse(BaseModel):
    ok: bool
    id: str = ""
    msg: str = ""


# ---------------------------------------------------------------------------
# Auth hook endpoint
# ---------------------------------------------------------------------------

@router.post("/hysteria/auth", response_model=HysteriaAuthResponse)
def hysteria_auth(
    body: HysteriaAuthRequest,
    token: str = Query(default=""),
):
    """
    HTTP auth hook for hysteriad.

    hysteriad calls this on every new client connection. The in-memory cache
    makes each check an O(1) dict lookup; the DB is queried at most once per
    _CACHE_TTL seconds, so performance scales to any number of users.

    Protect with HYSTERIA2_HOOK_TOKEN in .env and pass ?token=... in the URL
    configured in hysteria.yaml.
    """
    if HYSTERIA2_HOOK_TOKEN and token != HYSTERIA2_HOOK_TOKEN:
        raise HTTPException(status_code=403, detail="Invalid hook token")

    if not body.auth:
        return HysteriaAuthResponse(ok=False, msg="Empty auth string")

    username = _get_cache().get(body.auth)
    if username:
        return HysteriaAuthResponse(ok=True, id=username)

    return HysteriaAuthResponse(ok=False, msg="Invalid credentials or user inactive")

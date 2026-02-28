"""
In-memory auth cache for Hysteria2.

Imported by both app.xray.operations (to invalidate) and
app.routers.hysteria (to look up passwords). Lives in app.utils to avoid
the circular-import chain: operations -> routers -> app.xray -> operations.
"""

import threading
import time

_CACHE_TTL = 5.0  # seconds between DB refreshes

_cache: dict[str, str] = {}   # password -> username
_cache_lock = threading.Lock()
_cache_ts: float = 0.0


def build_cache() -> dict[str, str]:
    """Query DB for all active HYSTERIA2 passwords. Called lazily."""
    from app.db import GetDB
    from app.db import models as db_models
    from app.models.proxy import ProxyTypes
    from app.models.user import UserStatus

    result: dict[str, str] = {}
    with GetDB() as db:
        from sqlalchemy import func as sa_func
        rows = (
            db.query(db_models.User.username, db_models.Proxy.settings)
            .join(db_models.Proxy, db_models.User.id == db_models.Proxy.user_id)
            .filter(
                sa_func.upper(db_models.Proxy.type) == "HYSTERIA2",
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


def get_cache() -> dict[str, str]:
    """Return the cache, refreshing from DB if TTL has expired."""
    global _cache, _cache_ts
    now = time.monotonic()
    if now - _cache_ts < _CACHE_TTL:
        return _cache
    with _cache_lock:
        if now - _cache_ts < _CACHE_TTL:  # double-checked locking
            return _cache
        _cache = build_cache()
        _cache_ts = time.monotonic()
    return _cache


def invalidate_hysteria_cache() -> None:
    """Force the next lookup to rebuild the cache immediately."""
    global _cache_ts
    with _cache_lock:
        _cache_ts = 0.0

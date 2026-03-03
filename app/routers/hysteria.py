from datetime import datetime
from typing import List

from fastapi import APIRouter, Depends, Header, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy import update

from app.db import GetDB, Session, get_db
from app.db import models as db_models
from app.db.models import Proxy, User as DBUser
from app.models.admin import Admin
from app.models.proxy import ProxyTypes, Hysteria2Settings
from app.utils.hysteria_cache import get_cache, invalidate_hysteria_cache
from config import HYSTERIA2_HOOK_TOKEN

router = APIRouter(tags=["Hysteria2"], prefix="/api")

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
    authorization: str = Header(default=""),
):
    """
    HTTP auth hook for hysteriad.

    hysteriad calls this on every new client connection. The in-memory cache
    makes each check an O(1) dict lookup; the DB is queried at most once per
    _CACHE_TTL seconds, so performance scales to any number of users.

    Token accepted via:
      - query param  ?token=<token>
      - HTTP header  Authorization: Bearer <token>
    """
    # Extract bearer token from Authorization header when query param is absent
    if not token and authorization.startswith("Bearer "):
        token = authorization[len("Bearer "):]

    if HYSTERIA2_HOOK_TOKEN and token != HYSTERIA2_HOOK_TOKEN:
        raise HTTPException(status_code=403, detail="Invalid hook token")

    if not body.auth:
        _track_auth(False, body.addr)
        return HysteriaAuthResponse(ok=False, msg="Empty auth string")

    username = get_cache().get(body.auth)
    if username:
        with GetDB() as db:
            db.execute(
                update(DBUser)
                .where(DBUser.username == username)
                .values(online_at=datetime.utcnow())
            )
            db.commit()
        _track_auth(True, body.addr)
        return HysteriaAuthResponse(ok=True, id=username)

    _track_auth(False, body.addr)
    return HysteriaAuthResponse(ok=False, msg="Invalid credentials or user inactive")


def _track_auth(success: bool, addr: str):
    try:
        from app.monitoring import monitoring
        monitoring.record_hysteria_auth(success, addr)
    except Exception:
        pass


# ---------------------------------------------------------------------------
# Bulk management endpoints (admin only)
# ---------------------------------------------------------------------------

class BulkActionResponse(BaseModel):
    affected: int
    message: str


@router.post("/hysteria/users/enable", response_model=BulkActionResponse)
def bulk_enable_hysteria(
    db: Session = Depends(get_db),
    admin: Admin = Depends(Admin.get_current),
):
    """
    Add a Hysteria2 proxy with a fresh random password to every user that
    does not already have one. Requires admin authentication.
    """
    all_users: List[DBUser] = db.query(DBUser).all()
    count = 0
    for user in all_users:
        already_has = any(p.type == ProxyTypes.HYSTERIA2 for p in user.proxies)
        if already_has:
            continue
        settings = Hysteria2Settings()
        new_proxy = Proxy(
            type=ProxyTypes.HYSTERIA2,
            settings=settings.dict(no_obj=True),
        )
        user.proxies.append(new_proxy)
        count += 1

    if count:
        db.commit()
        invalidate_hysteria_cache()

    return BulkActionResponse(
        affected=count,
        message=f"Hysteria2 enabled for {count} user(s).",
    )


@router.post("/hysteria/users/disable", response_model=BulkActionResponse)
def bulk_disable_hysteria(
    db: Session = Depends(get_db),
    admin: Admin = Depends(Admin.get_current),
):
    """
    Remove the Hysteria2 proxy from every user that has one.
    Requires admin authentication.
    """
    proxies = db.query(Proxy).filter(
        Proxy.type == ProxyTypes.HYSTERIA2
    ).all()

    count = len(proxies)
    for proxy in proxies:
        db.delete(proxy)

    if count:
        db.commit()
        invalidate_hysteria_cache()

    return BulkActionResponse(
        affected=count,
        message=f"Hysteria2 removed from {count} user(s).",
    )

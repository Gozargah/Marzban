from datetime import datetime

from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy import update

from app.db import GetDB
from app.db.models import User as DBUser
from app.utils.hysteria_cache import get_cache
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

    username = get_cache().get(body.auth)
    if username:
        # Mark the user as online immediately upon connection
        with GetDB() as db:
            db.execute(
                update(DBUser)
                .where(DBUser.username == username)
                .values(online_at=datetime.utcnow())
            )
            db.commit()
        return HysteriaAuthResponse(ok=True, id=username)

    return HysteriaAuthResponse(ok=False, msg="Invalid credentials or user inactive")

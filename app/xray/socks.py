from __future__ import annotations

from datetime import datetime
from hashlib import sha256

from app.models.user import UserStatus
from app.utils.jwt import get_secret_key


def socks5_username(username: str) -> str:
    return username


def socks5_password(
    user_id: int,
    username: str,
    sub_revoked_at: datetime | None = None,
) -> str:
    # Rotate SOCKS5 password after subscription revoke.
    revoked_at = int(sub_revoked_at.timestamp()) if sub_revoked_at else 0
    raw = f"{user_id}:{username}:{revoked_at}:{get_secret_key()}"
    return sha256(raw.encode()).hexdigest()[:24]


def status_has_socks_access(status: UserStatus) -> bool:
    return status in (UserStatus.active, UserStatus.on_hold)

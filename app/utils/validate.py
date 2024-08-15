from datetime import datetime, timezone
from typing import Optional, Union
from app.models.admin import Admin
from app.models.user import UserStatus
from app.db import Session, crud


def validate_dates(start: Optional[Union[str, datetime]], end: Optional[Union[str, datetime]]) -> bool:
    try:
        if start:
            start_date = start if isinstance(start, datetime) else datetime.fromisoformat(start)
        if end:
            end_date = end if isinstance(end, datetime) else datetime.fromisoformat(end)
            if start and end_date < start_date:
                return False
        return True
    except ValueError:
        return False
    

def get_expired_users(db: Session, admin: Admin, expired_after: Optional[datetime] = None, expired_before: Optional[datetime] = None):

    expired_before = expired_before or datetime.now(timezone.utc)
    expired_after = expired_after or datetime.min.replace(tzinfo=timezone.utc)

    dbadmin = crud.get_admin(db, admin.username)
    dbusers = crud.get_users(
        db=db,
        status=[UserStatus.expired, UserStatus.limited],
        admin=dbadmin if not admin.is_sudo else None
    )

    return [
        u for u in dbusers
        if u.expire and expired_after.timestamp() <= u.expire <= expired_before.timestamp()
    ]
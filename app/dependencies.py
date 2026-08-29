import hmac
from typing import Optional, Union
from app.models.admin import AdminInDB, AdminValidationResult, Admin
from app.models.user import UserResponse, UserStatus
from app.db import Session, crud, get_db
from config import SUDOERS
from fastapi import Depends, HTTPException, Request
from datetime import datetime, timezone, timedelta
from app.utils import hwid
from app.utils.jwt import get_subscription_payload


def validate_admin(db: Session, username: str, password: str) -> Optional[AdminValidationResult]:
    """Validate admin credentials with environment variables or database."""
    # The .env sudoer's password is stored in the clear, so it is the one
    # comparison here that is not already constant time — bcrypt's own is.
    # Encoded first: compare_digest rejects a str holding anything non-ASCII.
    env_password = SUDOERS.get(username)
    if env_password is not None and hmac.compare_digest(
        env_password.encode("utf-8"), password.encode("utf-8")
    ):
        return AdminValidationResult(username=username, is_sudo=True)

    dbadmin = crud.get_admin(db, username)
    if dbadmin and AdminInDB.model_validate(dbadmin).verify_password(password):
        return AdminValidationResult(username=dbadmin.username, is_sudo=dbadmin.is_sudo)

    return None


def get_admin_by_username(username: str, db: Session = Depends(get_db)):
    """Fetch an admin by username from the database."""
    dbadmin = crud.get_admin(db, username)
    if not dbadmin:
        raise HTTPException(status_code=404, detail="Admin not found")
    return dbadmin


def get_dbnode(node_id: int, db: Session = Depends(get_db)):
    """Fetch a node by its ID from the database, raising a 404 error if not found."""
    dbnode = crud.get_node_by_id(db, node_id)
    if not dbnode:
        raise HTTPException(status_code=404, detail="Node not found")
    return dbnode


def validate_dates(start: Optional[Union[str, datetime]], end: Optional[Union[str, datetime]]) -> (datetime, datetime):
    """Validate if start and end dates are correct and if end is after start."""
    try:
        if start:
            start_date = start if isinstance(start, datetime) else datetime.fromisoformat(
                start).astimezone(timezone.utc)
        else:
            start_date = datetime.now(timezone.utc) - timedelta(days=30)
        if end:
            end_date = end if isinstance(end, datetime) else datetime.fromisoformat(end).astimezone(timezone.utc)
            if start_date and end_date < start_date:
                raise HTTPException(status_code=400, detail="Start date must be before end date")
        else:
            end_date = datetime.now(timezone.utc)

        return start_date, end_date
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid date range or format")


def get_user_template(template_id: int, db: Session = Depends(get_db)):
    """Fetch a User Template by its ID, raise 404 if not found."""
    dbuser_template = crud.get_user_template(db, template_id)
    if not dbuser_template:
        raise HTTPException(status_code=404, detail="User Template not found")
    return dbuser_template


# Said to a client that is over its limit or will not identify itself. It is
# the only place a subscriber learns why, so it says what to do about it
# rather than only that something is wrong.
NO_HWID_DETAIL = (
    "This subscription is limited to a number of devices, and your client did not identify "
    "itself. Use a client that reports a device id, or ask your provider to lift the limit."
)
DEVICE_LIMIT_DETAIL = (
    "This subscription has reached its device limit. Ask your provider to remove a device "
    "you no longer use."
)


def enforce_device_limit(db: Session, dbuser, request: Request) -> None:
    """Register the device this request came from, or refuse it.

    Runs before anything hands out a configuration. A user with no limit is
    not touched at all — no header is read and no device is recorded — so the
    feature costs nothing until somebody turns it on, and turning it on for
    one user does not start tracking every other one.

    With a limit in force, a client that sends no identifier is refused. That
    is the strict reading and it is worth knowing what it excludes: a browser
    opening the subscription page, and any client that does not send the
    header, are both turned away. It is deliberate — the alternative lets
    anyone opt out of the limit by using a different client.
    """
    if not hwid.is_enforced(dbuser):
        return

    identity = hwid.identity_from_headers(request.headers)
    if identity is None:
        raise HTTPException(status_code=403, detail=NO_HWID_DETAIL)

    user_agent = request.headers.get("user-agent", "")
    if crud.touch_user_device(db, dbuser, identity, user_agent):
        return

    # A known device is always let through, even once the limit has been
    # lowered below the number already registered: taking a device away is an
    # admin's decision, not a side effect of editing a number.
    if crud.count_user_devices(db, dbuser) >= hwid.effective_limit(dbuser):
        raise HTTPException(status_code=403, detail=DEVICE_LIMIT_DETAIL)

    crud.add_user_device(db, dbuser, identity, user_agent)


def get_validated_sub(
        request: Request,
        token: str,
        db: Session = Depends(get_db)
) -> UserResponse:
    sub = get_subscription_payload(token)
    if not sub:
        raise HTTPException(status_code=404, detail="Not Found")

    dbuser = crud.get_user(db, sub['username'])
    if not dbuser or dbuser.created_at > sub['created_at']:
        raise HTTPException(status_code=404, detail="Not Found")

    if dbuser.sub_revoked_at and dbuser.sub_revoked_at > sub['created_at']:
        raise HTTPException(status_code=404, detail="Not Found")

    # After the token is settled and not before: an unknown token must look
    # the same whether or not the user behind it has a device limit.
    enforce_device_limit(db, dbuser, request)

    return dbuser


def get_validated_user(
        username: str,
        admin: Admin = Depends(Admin.get_current),
        db: Session = Depends(get_db)
) -> UserResponse:
    dbuser = crud.get_user(db, username)
    if not dbuser:
        raise HTTPException(status_code=404, detail="User not found")

    if not (admin.is_sudo or (dbuser.admin and dbuser.admin.username == admin.username)):
        raise HTTPException(status_code=403, detail="You're not allowed")

    return dbuser


def get_expired_users_list(db: Session, admin: Admin, expired_after: Optional[datetime] = None,
                           expired_before: Optional[datetime] = None):
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

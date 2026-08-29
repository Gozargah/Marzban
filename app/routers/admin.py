from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Request, Response, status
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.exc import IntegrityError

from app import logger, xray
from app.db import Session, crud, get_db
from app.dependencies import get_admin_by_username, validate_admin
from app.models.admin import Admin, AdminCreate, AdminModify, Token
from app.utils import report, responses
from app.utils.auth_cookie import clear_access_cookie, set_access_cookie
from app.utils.client_ip import forwarding_is_unconfigured, get_client_ip
from app.utils.jwt import create_admin_token
from app.utils.rate_limit import SlidingWindowRateLimiter
from config import (LOGIN_NOTIFY_WHITE_LIST, LOGIN_RATE_LIMIT_ATTEMPTS,
                    LOGIN_RATE_LIMIT_WINDOW)

router = APIRouter(tags=["Admin"], prefix="/api", responses={401: responses._401})

login_rate_limiter = SlidingWindowRateLimiter(
    attempts=LOGIN_RATE_LIMIT_ATTEMPTS, window=LOGIN_RATE_LIMIT_WINDOW
)

# Said once per process, when a block actually happens and the addresses look
# like they all come from an unconfigured proxy. Repeating it on every 429
# would bury the thing it is trying to explain.
_warned_about_forwarding = False


def login_key(client_ip: str, username: str) -> str:
    """What a failed login is counted against.

    Not the address on its own. Behind a reverse proxy whose address is not in
    TRUSTED_PROXIES every request carries that proxy's address, and counting by
    address alone would let one attacker's failures lock every admin out of the
    panel. Pairing it with the account keeps a flood aimed at one login away
    from the others. Case is folded so `Root` and `root` cannot be counted
    apart on a database that treats them as the same account.
    """
    return f"{client_ip}\n{username.strip().lower()}"


def _warn_about_forwarding_once(client_ip: str) -> None:
    global _warned_about_forwarding

    if _warned_about_forwarding or not forwarding_is_unconfigured(client_ip):
        return

    _warned_about_forwarding = True
    logger.warning(
        f"Blocked a login from {client_ip}, which is this host's own network. TRUSTED_PROXIES "
        "is empty, so X-Forwarded-For is ignored and every client behind your reverse proxy "
        "shares one address here: anyone can get an admin account rate limited, and login "
        "notifications name the proxy rather than the client. Set TRUSTED_PROXIES to your "
        "proxy's address."
    )


@router.post("/admin/token", response_model=Token, responses={429: responses._429})
def admin_token(
    request: Request,
    response: Response,
    form_data: OAuth2PasswordRequestForm = Depends(),
    db: Session = Depends(get_db),
):
    """Authenticate an admin, set the session cookie and return the token."""
    client_ip = get_client_ip(request)
    attempt_key = login_key(client_ip, form_data.username)

    retry_after = login_rate_limiter.retry_after(attempt_key)
    if retry_after:
        _warn_about_forwarding_once(client_ip)
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="Too many failed login attempts. Try again later.",
            headers={"Retry-After": str(retry_after)},
        )

    dbadmin = validate_admin(db, form_data.username, form_data.password)
    if not dbadmin:
        login_rate_limiter.record_failure(attempt_key)
        report.login(form_data.username, client_ip, False)
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect username or password",
            headers={"WWW-Authenticate": "Bearer"},
        )

    login_rate_limiter.reset(attempt_key)

    if client_ip not in LOGIN_NOTIFY_WHITE_LIST:
        report.login(form_data.username, client_ip, True)

    token = create_admin_token(form_data.username, dbadmin.is_sudo)
    # The dashboard rides on the cookie; the body keeps the CLI and other API
    # clients working with the Authorization header.
    set_access_cookie(response, request, token)

    return Token(access_token=token)


@router.post("/admin/logout")
def admin_logout(request: Request, response: Response):
    """Drop the session cookie. Deliberately unauthenticated so an expired
    session can still be cleaned up."""
    clear_access_cookie(response, request)
    return {"detail": "Logged out"}


@router.post(
    "/admin",
    response_model=Admin,
    responses={403: responses._403, 409: responses._409},
)
def create_admin(
    new_admin: AdminCreate,
    db: Session = Depends(get_db),
    admin: Admin = Depends(Admin.check_sudo_admin),
):
    """Create a new admin if the current admin has sudo privileges."""
    try:
        dbadmin = crud.create_admin(db, new_admin)
    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=409, detail="Admin already exists")

    return dbadmin


@router.put(
    "/admin/{username}",
    response_model=Admin,
    responses={403: responses._403, 404: responses._404},
)
def modify_admin(
    modified_admin: AdminModify,
    dbadmin: Admin = Depends(get_admin_by_username),
    db: Session = Depends(get_db),
    current_admin: Admin = Depends(Admin.check_sudo_admin),
):
    """Replace an existing admin's details.

    Everything is taken as sent: an omitted telegram_id or discord_webhook
    clears the stored one, and only an omitted password is left alone.
    """
    if (dbadmin.username != current_admin.username) and dbadmin.is_sudo:
        raise HTTPException(
            status_code=403,
            detail="You're not allowed to edit another sudoer's account. Use xenith-cli instead.",
        )

    # Only the caller's own account can be a sudoer here, the check above having
    # turned away every other one. Dropping your own sudo through the API would
    # leave nobody able to give it back, so that stays a CLI operation.
    if dbadmin.is_sudo and not modified_admin.is_sudo:
        raise HTTPException(
            status_code=403,
            detail="You're not allowed to remove your own sudo access. Use xenith-cli instead.",
        )

    updated_admin = crud.update_admin(db, dbadmin, modified_admin)

    return updated_admin


@router.delete(
    "/admin/{username}",
    responses={403: responses._403},
)
def remove_admin(
    dbadmin: Admin = Depends(get_admin_by_username),
    db: Session = Depends(get_db),
    current_admin: Admin = Depends(Admin.check_sudo_admin),
):
    """Remove an admin from the database."""
    if dbadmin.is_sudo:
        raise HTTPException(
            status_code=403,
            detail="You're not allowed to delete sudo accounts. Use xenith-cli instead.",
        )

    crud.remove_admin(db, dbadmin)
    return {"detail": "Admin removed successfully"}


@router.get("/admin", response_model=Admin)
def get_current_admin(admin: Admin = Depends(Admin.get_current)):
    """Retrieve the current authenticated admin."""
    return admin


@router.get(
    "/admins",
    response_model=List[Admin],
    responses={403: responses._403},
)
def get_admins(
    offset: Optional[int] = None,
    limit: Optional[int] = None,
    username: Optional[str] = None,
    db: Session = Depends(get_db),
    admin: Admin = Depends(Admin.check_sudo_admin),
):
    """Fetch a list of admins with optional filters for pagination and username."""
    return crud.get_admins(db, offset, limit, username)


@router.post("/admin/{username}/users/disable", responses={403: responses._403, 404: responses._404})
def disable_all_active_users(
    dbadmin: Admin = Depends(get_admin_by_username),
    db: Session = Depends(get_db), admin: Admin = Depends(Admin.check_sudo_admin)
):
    """Disable all active users under a specific admin"""
    crud.disable_all_active_users(db=db, admin=dbadmin)
    startup_config = xray.config.include_db_users()
    xray.core.restart(startup_config)
    for node_id, node in list(xray.nodes.items()):
        if node.connected:
            xray.operations.restart_node(node_id, startup_config)
    return {"detail": "Users successfully disabled"}


@router.post("/admin/{username}/users/activate", responses={403: responses._403, 404: responses._404})
def activate_all_disabled_users(
    dbadmin: Admin = Depends(get_admin_by_username),
    db: Session = Depends(get_db), admin: Admin = Depends(Admin.check_sudo_admin)
):
    """Activate all disabled users under a specific admin"""
    crud.activate_all_disabled_users(db=db, admin=dbadmin)
    startup_config = xray.config.include_db_users()
    xray.core.restart(startup_config)
    for node_id, node in list(xray.nodes.items()):
        if node.connected:
            xray.operations.restart_node(node_id, startup_config)
    return {"detail": "Users successfully activated"}


@router.post(
    "/admin/usage/reset/{username}",
    response_model=Admin,
    responses={403: responses._403},
)
def reset_admin_usage(
    dbadmin: Admin = Depends(get_admin_by_username),
    db: Session = Depends(get_db),
    current_admin: Admin = Depends(Admin.check_sudo_admin)
):
    """Resets usage of admin."""
    return crud.reset_admin_usage(db, dbadmin)


@router.get(
    "/admin/usage/{username}",
    response_model=int,
    responses={403: responses._403},
)
def get_admin_usage(
    dbadmin: Admin = Depends(get_admin_by_username),
    current_admin: Admin = Depends(Admin.check_sudo_admin)
):
    """Retrieve the usage of given admin."""
    return dbadmin.users_usage

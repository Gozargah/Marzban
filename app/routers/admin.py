from typing import List, Optional

import secrets
from datetime import datetime, timedelta
from hashlib import sha256

from fastapi import APIRouter, Depends, HTTPException, Request, Response, status
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.exc import IntegrityError

from app import xray
from app.db import Session, crud, get_db
from app.db.models import AdminSession
from app.dependencies import get_admin_by_username, validate_admin
from app.models.admin import Admin, AdminCreate, AdminModify, AdminSessionResponse, Token
from app.utils.admin_session import CSRF_COOKIE, SESSION_COOKIE, require_same_origin
from app.utils import report, responses
from app.utils.jwt import create_admin_token
from app.utils.jwt import get_admin_payload
from config import AUTH_COOKIE_SAMESITE, AUTH_COOKIE_SECURE, JWT_ACCESS_TOKEN_EXPIRE_MINUTES, LOGIN_NOTIFY_WHITE_LIST

router = APIRouter(tags=["Admin"], prefix="/api", responses={401: responses._401})


def get_client_ip(request: Request) -> str:
    """Extract the client's IP address from the request headers or client."""
    forwarded_for = request.headers.get("X-Forwarded-For")
    if forwarded_for:
        return forwarded_for.split(",")[0].strip()
    if request.client:
        return request.client.host
    return "Unknown"


@router.post("/admin/token", response_model=Token)
def admin_token(
    request: Request,
    form_data: OAuth2PasswordRequestForm = Depends(),
    db: Session = Depends(get_db),
):
    """Authenticate an admin and issue a token."""
    client_ip = get_client_ip(request)

    dbadmin = validate_admin(db, form_data.username, form_data.password)
    if not dbadmin:
        report.login(form_data.username, client_ip, False)
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect username or password",
            headers={"WWW-Authenticate": "Bearer"},
        )

    if client_ip not in LOGIN_NOTIFY_WHITE_LIST:
        report.login(form_data.username, client_ip, True)

    return Token(access_token=create_admin_token(form_data.username, dbadmin.is_sudo))


@router.post("/admin/session", response_model=AdminSessionResponse)
def create_admin_session(
    request: Request,
    response: Response,
    form_data: OAuth2PasswordRequestForm = Depends(),
    db: Session = Depends(get_db),
):
    """Create a browser session using HttpOnly cookies instead of returning a JS-readable token."""
    require_same_origin(request)
    client_ip = get_client_ip(request)
    dbadmin = validate_admin(db, form_data.username, form_data.password)
    if not dbadmin:
        report.login(form_data.username, client_ip, False)
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Incorrect username or password")

    if client_ip not in LOGIN_NOTIFY_WHITE_LIST:
        report.login(form_data.username, client_ip, True)

    session_id = secrets.token_urlsafe(32)
    expires_at = datetime.utcnow() + timedelta(minutes=JWT_ACCESS_TOKEN_EXPIRE_MINUTES) if JWT_ACCESS_TOKEN_EXPIRE_MINUTES > 0 else None
    db.query(AdminSession).filter(AdminSession.expires_at.isnot(None), AdminSession.expires_at < datetime.utcnow()).delete(synchronize_session=False)
    db.add(AdminSession(session_hash=sha256(session_id.encode()).hexdigest(), username=form_data.username, expires_at=expires_at))
    db.commit()
    token = create_admin_token(form_data.username, dbadmin.is_sudo, session_id=session_id)
    cookie_options = {
        "secure": AUTH_COOKIE_SECURE,
        "samesite": AUTH_COOKIE_SAMESITE,
        "path": "/api",
    }
    max_age = JWT_ACCESS_TOKEN_EXPIRE_MINUTES * 60 if JWT_ACCESS_TOKEN_EXPIRE_MINUTES > 0 else None
    csrf_token = secrets.token_urlsafe(32)
    response.set_cookie(SESSION_COOKIE, token, httponly=True, max_age=max_age, **cookie_options)
    response.set_cookie(CSRF_COOKIE, csrf_token, httponly=False, max_age=max_age, path="/", secure=AUTH_COOKIE_SECURE, samesite=AUTH_COOKIE_SAMESITE)
    response.headers["Cache-Control"] = "no-store"
    return AdminSessionResponse(username=dbadmin.username, is_sudo=dbadmin.is_sudo, csrf_token=csrf_token)


@router.get("/admin/session/csrf")
def get_admin_session_csrf(
    request: Request,
    response: Response,
    _: Admin = Depends(Admin.get_current),
):
    """Return the CSRF value for a cookie-authenticated browser session."""
    csrf_token = request.cookies.get(CSRF_COOKIE) or secrets.token_urlsafe(32)
    if not request.cookies.get(CSRF_COOKIE):
        max_age = JWT_ACCESS_TOKEN_EXPIRE_MINUTES * 60 if JWT_ACCESS_TOKEN_EXPIRE_MINUTES > 0 else None
        response.set_cookie(CSRF_COOKIE, csrf_token, httponly=False, max_age=max_age, path="/", secure=AUTH_COOKIE_SECURE, samesite=AUTH_COOKIE_SAMESITE)
    response.headers["Cache-Control"] = "no-store"
    return {"csrf_token": csrf_token}


@router.delete("/admin/session", status_code=status.HTTP_204_NO_CONTENT)
def delete_admin_session(request: Request, response: Response, db: Session = Depends(get_db)):
    """Clear browser session cookies after validating the request origin."""
    # Logging out is safe even when a stale browser session has no CSRF cookie.
    # Same-origin validation still prevents cross-site logout requests.
    require_same_origin(request)
    token = request.cookies.get(SESSION_COOKIE)
    payload = get_admin_payload(token) if token else None
    if payload and payload.get("session_id"):
        session_hash = sha256(payload["session_id"].encode()).hexdigest()
        db.query(AdminSession).filter(AdminSession.session_hash == session_hash).delete(synchronize_session=False)
        db.commit()
    response.delete_cookie(SESSION_COOKIE, path="/api", secure=AUTH_COOKIE_SECURE, httponly=True, samesite=AUTH_COOKIE_SAMESITE)
    response.delete_cookie(CSRF_COOKIE, path="/", secure=AUTH_COOKIE_SECURE, httponly=False, samesite=AUTH_COOKIE_SAMESITE)
    response.status_code = status.HTTP_204_NO_CONTENT


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
    """Modify an existing admin's details."""
    if (dbadmin.username != current_admin.username) and dbadmin.is_sudo:
        raise HTTPException(
            status_code=403,
            detail="You're not allowed to edit another sudoer's account. Use marzban-cli instead.",
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
            detail="You're not allowed to delete sudo accounts. Use marzban-cli instead.",
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

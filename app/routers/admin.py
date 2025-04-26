import asyncio
from fastapi import APIRouter, Depends, HTTPException, Request, status, Header
from fastapi.security import OAuth2PasswordRequestForm
from app import notification
from app.db import AsyncSession, get_db
from app.models.admin import AdminCreate, AdminDetails, AdminModify, Token
from app.operation import OperatorType
from app.operation.admin import AdminOperation
from app.utils import responses
from app.utils.jwt import create_admin_token
from .authentication import check_sudo_admin, get_current, validate_admin, validate_mini_app_admin

router = APIRouter(tags=["Admin"], prefix="/api/admin", responses={401: responses._401, 403: responses._403})
admin_operator = AdminOperation(operator_type=OperatorType.API)


def get_client_ip(request: Request) -> str:
    """Extract the client's IP address from the request headers or client."""
    forwarded_for = request.headers.get("X-Forwarded-For")
    if forwarded_for:
        return forwarded_for.split(",")[0].strip()
    if request.client:
        return request.client.host
    return "Unknown"


@router.post("/token", response_model=Token)
async def admin_token(
    request: Request, form_data: OAuth2PasswordRequestForm = Depends(), db: AsyncSession = Depends(get_db)
):
    """Authenticate an admin and issue a token."""
    client_ip = get_client_ip(request)

    db_admin = await validate_admin(db, form_data.username, form_data.password)
    if not db_admin:
        asyncio.create_task(notification.admin_login(form_data.username, form_data.password, client_ip, False))
        raise HTTPException(
            status_code=401,
            detail="Incorrect username or password",
            headers={"WWW-Authenticate": "Bearer"},
        )
    if db_admin.is_disabled:
        asyncio.create_task(notification.admin_login(form_data.username, form_data.password, client_ip, False))
        raise HTTPException(
            status_code=403,
            detail="your account has been disabled",
            headers={"WWW-Authenticate": "Bearer"},
        )
    asyncio.create_task(notification.admin_login(db_admin.username, "", client_ip, True))
    return Token(access_token=await create_admin_token(form_data.username, db_admin.is_sudo))


@router.post("/miniapp/token")
async def admin_mini_app_token(
    request: Request, x_telegram_authorization: str = Header(), db: AsyncSession = Depends(get_db)
):
    """Authenticate an admin and issue a token."""

    client_ip = get_client_ip(request)

    db_admin = await validate_mini_app_admin(db, x_telegram_authorization)
    if not db_admin:
        raise HTTPException(
            status_code=401,
            detail="admin not found.",
            headers={"WWW-Authenticate": "Bearer"},
        )
    if db_admin.is_disabled:
        raise HTTPException(
            status_code=403,
            detail="your account has been disabled",
            headers={"WWW-Authenticate": "Bearer"},
        )
    asyncio.create_task(notification.admin_login(db_admin.username, "", client_ip, True))
    return Token(access_token=await create_admin_token(db_admin.username, db_admin.is_sudo))


@router.post(
    "",
    response_model=AdminDetails,
    responses={201: {"description": "Admin created successfully"}, 409: responses._409},
    status_code=status.HTTP_201_CREATED,
)
async def create_admin(
    new_admin: AdminCreate, db: AsyncSession = Depends(get_db), admin: AdminDetails = Depends(check_sudo_admin)
):
    """Create a new admin if the current admin has sudo privileges."""
    return await admin_operator.create_admin(db, new_admin=new_admin, admin=admin)


@router.put("/{username}", response_model=AdminDetails, responses={403: responses._403, 404: responses._404})
async def modify_admin(
    username: str,
    modified_admin: AdminModify,
    db: AsyncSession = Depends(get_db),
    current_admin: AdminDetails = Depends(check_sudo_admin),
):
    """Modify an existing admin's details."""
    return await admin_operator.modify_admin(
        db, username=username, modified_admin=modified_admin, current_admin=current_admin
    )


@router.delete("/{username}", status_code=status.HTTP_204_NO_CONTENT)
async def remove_admin(
    username: str, db: AsyncSession = Depends(get_db), current_admin: AdminDetails = Depends(check_sudo_admin)
):
    """Remove an admin from the database."""
    await admin_operator.remove_admin(db, username=username, current_admin=current_admin)
    return {}


@router.get("", response_model=AdminDetails)
def get_current_admin(admin: AdminDetails = Depends(get_current)):
    """Retrieve the current authenticated admin."""
    return admin


@router.get("s", response_model=list[AdminDetails])
async def get_admins(
    username: str | None = None,
    offset: int | None = None,
    limit: int | None = None,
    db: AsyncSession = Depends(get_db),
    _: AdminDetails = Depends(check_sudo_admin),
):
    """Fetch a list of admins with optional filters for pagination and username."""
    return await admin_operator.get_admins(db, username=username, offset=offset, limit=limit)


@router.post("/{username}/users/disable", responses={404: responses._404})
async def disable_all_active_users(
    username: str, db: AsyncSession = Depends(get_db), admin: AdminDetails = Depends(check_sudo_admin)
):
    """Disable all active users under a specific admin"""
    await admin_operator.disable_all_active_users(db, username=username, admin=admin)
    return {}


@router.post("/{username}/users/activate", responses={404: responses._404})
async def activate_all_disabled_users(
    username: str, db: AsyncSession = Depends(get_db), admin: AdminDetails = Depends(check_sudo_admin)
):
    """Activate all disabled users under a specific admin"""
    await admin_operator.activate_all_disabled_users(db, username=username, admin=admin)
    return {}


@router.post("/{username}/reset", response_model=AdminDetails, responses={404: responses._404})
async def reset_admin_usage(
    username: str, db: AsyncSession = Depends(get_db), admin: AdminDetails = Depends(check_sudo_admin)
):
    """Resets usage of admin."""
    return await admin_operator.reset_admin_usage(db, username=username, admin=admin)

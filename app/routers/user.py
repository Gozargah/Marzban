from datetime import datetime as dt

from fastapi import APIRouter, Depends, Query, status

from app.db import AsyncSession, get_db
from app.db.models import UserStatus
from app.models.admin import AdminDetails
from app.models.stats import Period, UserUsageStatsList
from app.models.user import (
    BulkUser,
    BulkUsersProxy,
    CreateUserFromTemplate,
    ModifyUserByTemplate,
    RemoveUsersResponse,
    UserCreate,
    UserModify,
    UserResponse,
    UsersResponse,
    UserSubscriptionUpdateList,
)
from app.operation import OperatorType
from app.operation.node import NodeOperation
from app.operation.user import UserOperation
from app.utils import responses

from .authentication import check_sudo_admin, get_current

user_operator = UserOperation(operator_type=OperatorType.API)
node_operator = NodeOperation(operator_type=OperatorType.API)
router = APIRouter(tags=["User"], prefix="/api/user", responses={401: responses._401})


@router.post(
    "",
    response_model=UserResponse,
    responses={400: responses._400, 409: responses._409},
    status_code=status.HTTP_201_CREATED,
)
async def create_user(
    new_user: UserCreate, db: AsyncSession = Depends(get_db), admin: AdminDetails = Depends(get_current)
):
    """
    Create a new user

    - **username**: 3 to 32 characters, can include a-z, 0-9, and underscores.
    - **status**: User's status, defaults to `active`. Special rules if `on_hold`.
    - **expire**: UTC datetime for account expiration. Use `0` for unlimited.
    - **data_limit**: Max data usage in bytes (e.g., `1073741824` for 1GB). `0` means unlimited.
    - **data_limit_reset_strategy**: Defines how/if data limit resets. `no_reset` means it never resets.
    - **proxy_settings**: Dictionary of protocol settings (e.g., `vmess`, `vless`) will generate data for all protocol by default.
    - **group_ids**: List of group IDs to assign to the user.
    - **note**: Optional text field for additional user information or notes.
    - **on_hold_timeout**: UTC timestamp when `on_hold` status should start or end.
    - **on_hold_expire_duration**: Duration (in seconds) for how long the user should stay in `on_hold` status.
    - **next_plan**: Next user plan (resets after use).
    """

    return await user_operator.create_user(db, new_user=new_user, admin=admin)


@router.put(
    "/{username}",
    response_model=UserResponse,
    responses={400: responses._400, 403: responses._403, 404: responses._404},
)
async def modify_user(
    username: str,
    modified_user: UserModify,
    db: AsyncSession = Depends(get_db),
    admin: AdminDetails = Depends(get_current),
):
    """
    Modify an existing user

    - **username**: Cannot be changed. Used to identify the user.
    - **status**: User's new status. Can be 'active', 'disabled', 'on_hold', 'limited', or 'expired'.
    - **expire**: UTC datetime for new account expiration. Set to `0` for unlimited, `null` for no change.
    - **data_limit**: New max data usage in bytes (e.g., `1073741824` for 1GB). Set to `0` for unlimited, `null` for no change.
    - **data_limit_reset_strategy**: New strategy for data limit reset. Options include 'daily', 'weekly', 'monthly', or 'no_reset'.
    - **proxies**: Dictionary of new protocol settings (e.g., `vmess`, `vless`). Empty dictionary means no change.
    - **group_ids**: List of new group IDs to assign to the user. Empty list means no change.
    - **note**: New optional text for additional user information or notes. `null` means no change.
    - **on_hold_timeout**: New UTC timestamp for when `on_hold` status should start or end. Only applicable if status is changed to 'on_hold'.
    - **on_hold_expire_duration**: New duration (in seconds) for how long the user should stay in `on_hold` status. Only applicable if status is changed to 'on_hold'.
    - **next_plan**: Next user plan (resets after use).

    Note: Fields set to `null` or omitted will not be modified.
    """
    return await user_operator.modify_user(db, username=username, modified_user=modified_user, admin=admin)


@router.delete(
    "/{username}", responses={403: responses._403, 404: responses._404}, status_code=status.HTTP_204_NO_CONTENT
)
async def remove_user(username: str, db: AsyncSession = Depends(get_db), admin: AdminDetails = Depends(get_current)):
    """Remove a user"""
    return await user_operator.remove_user(db, username=username, admin=admin)


@router.post("/{username}/reset", response_model=UserResponse, responses={403: responses._403, 404: responses._404})
async def reset_user_data_usage(
    username: str, db: AsyncSession = Depends(get_db), admin: AdminDetails = Depends(get_current)
):
    """Reset user data usage"""
    return await user_operator.reset_user_data_usage(db, username=username, admin=admin)


@router.post(
    "/{username}/revoke_sub", response_model=UserResponse, responses={403: responses._403, 404: responses._404}
)
async def revoke_user_subscription(
    username: str, db: AsyncSession = Depends(get_db), admin: AdminDetails = Depends(get_current)
):
    """Revoke users subscription (Subscription link and proxies)"""
    return await user_operator.revoke_user_sub(db, username=username, admin=admin)


@router.post("s/reset", responses={403: responses._403, 404: responses._404})
async def reset_users_data_usage(db: AsyncSession = Depends(get_db), admin: AdminDetails = Depends(check_sudo_admin)):
    """Reset all users data usage"""
    await user_operator.reset_users_data_usage(db, admin)
    await node_operator.restart_all_node(db, admin)
    return {}


@router.put("/{username}/set_owner", response_model=UserResponse, responses={403: responses._403})
async def set_owner(
    username: str,
    admin_username: str,
    db: AsyncSession = Depends(get_db),
    admin: AdminDetails = Depends(check_sudo_admin),
):
    """Set a new owner (admin) for a user."""
    return await user_operator.set_owner(db, username=username, admin_username=admin_username, admin=admin)


@router.post(
    "/{username}/active_next", response_model=UserResponse, responses={403: responses._403, 404: responses._404}
)
async def active_next_plan(
    username: str, db: AsyncSession = Depends(get_db), admin: AdminDetails = Depends(get_current)
):
    """Reset user by next plan"""
    return await user_operator.active_next_plan(db, username=username, admin=admin)


@router.get("/{username}", response_model=UserResponse, responses={403: responses._403, 404: responses._404})
async def get_user(username: str, db: AsyncSession = Depends(get_db), admin: AdminDetails = Depends(get_current)):
    """Get user information"""
    return await user_operator.get_user(db=db, username=username, admin=admin)


@router.get(
    "/{username}/sub_update",
    response_model=UserSubscriptionUpdateList,
    responses={403: responses._403, 404: responses._404},
)
async def get_user_sub_update_list(
    username: str,
    offset: int = 0,
    limit: int = 10,
    db: AsyncSession = Depends(get_db),
    admin: AdminDetails = Depends(get_current),
):
    """Get user subscription agent list"""
    return await user_operator.get_user_sub_update_list(db, username=username, admin=admin, offset=offset, limit=limit)


@router.get(
    "s", response_model=UsersResponse, responses={400: responses._400, 403: responses._403, 404: responses._404}
)
async def get_users(
    offset: int = None,
    limit: int = None,
    username: list[str] = Query(None),
    owner: list[str] | None = Query(None, alias="admin"),
    group_ids: list[int] | None = Query(None, alias="group"),
    search: str | None = None,
    status: UserStatus | None = None,
    sort: str | None = None,
    proxy_id: str | None = None,
    load_sub: bool = False,
    db: AsyncSession = Depends(get_db),
    admin: AdminDetails = Depends(get_current),
):
    """Get all users"""
    return await user_operator.get_users(
        db=db,
        admin=admin,
        offset=offset,
        limit=limit,
        username=username,
        search=search,
        owner=owner,
        status=status,
        sort=sort,
        load_sub=load_sub,
        proxy_id=proxy_id,
        group_ids=group_ids,
    )


@router.get(
    "/{username}/usage", response_model=UserUsageStatsList, responses={403: responses._403, 404: responses._404}
)
async def get_user_usage(
    username: str,
    period: Period,
    node_id: int | None = None,
    group_by_node: bool = False,
    start: dt | None = Query(None, example="2024-01-01T00:00:00+03:30"),
    end: dt | None = Query(None, example="2024-01-31T23:59:59+03:30"),
    db: AsyncSession = Depends(get_db),
    admin: AdminDetails = Depends(get_current),
):
    """Get users usage"""
    return await user_operator.get_user_usage(
        db,
        username=username,
        admin=admin,
        start=start,
        end=end,
        period=period,
        node_id=node_id,
        group_by_node=group_by_node,
    )


@router.get("s/usage", response_model=UserUsageStatsList)
async def get_users_usage(
    period: Period,
    node_id: int | None = None,
    group_by_node: bool = False,
    start: dt | None = Query(None, example="2024-01-01T00:00:00+03:30"),
    end: dt | None = Query(None, example="2024-01-31T23:59:59+03:30"),
    db: AsyncSession = Depends(get_db),
    owner: list[str] | None = Query(None, alias="admin"),
    admin: AdminDetails = Depends(get_current),
):
    """Get all users usage"""
    return await user_operator.get_users_usage(
        db,
        admin=admin,
        start=start,
        end=end,
        owner=owner,
        period=period,
        node_id=node_id,
        group_by_node=group_by_node,
    )


@router.get("s/expired", response_model=list[str])
async def get_expired_users(
    db: AsyncSession = Depends(get_db),
    _: AdminDetails = Depends(check_sudo_admin),
    admin_username: str | None = None,
    expired_after: dt | None = Query(None, example="2024-01-01T00:00:00+03:30"),
    expired_before: dt | None = Query(None, example="2024-01-31T23:59:59+03:30"),
):
    """
    Get users who have expired within the specified date range.

    - **expired_after** UTC datetime (optional)
    - **expired_before** UTC datetime (optional)
    - At least one of expired_after or expired_before must be provided for filtering
    - If both are omitted, returns all expired users
    """

    return await user_operator.get_expired_users(db, expired_after, expired_before, admin_username)


@router.delete("s/expired", response_model=RemoveUsersResponse)
async def delete_expired_users(
    db: AsyncSession = Depends(get_db),
    admin: AdminDetails = Depends(check_sudo_admin),
    admin_username: str | None = None,
    expired_after: dt | None = Query(None, example="2024-01-01T00:00:00+03:30"),
    expired_before: dt | None = Query(None, example="2024-01-31T23:59:59+03:30"),
):
    """
    Delete users who have expired within the specified date range.

    - **expired_after** UTC datetime (optional)
    - **expired_before** UTC datetime (optional)
    - At least one of expired_after or expired_before must be provided
    """
    return await user_operator.delete_expired_users(
        db, admin, expired_after, expired_before, admin_username=admin_username
    )


@router.post("/from_template", status_code=status.HTTP_201_CREATED, response_model=UserResponse)
async def create_user_from_template(
    new_template_user: CreateUserFromTemplate,
    db: AsyncSession = Depends(get_db),
    admin: AdminDetails = Depends(get_current),
):
    return await user_operator.create_user_from_template(db, new_template_user, admin)


@router.put("/from_template/{username}", response_model=UserResponse)
async def modify_user_with_template(
    username: str,
    modify_template_user: ModifyUserByTemplate,
    db: AsyncSession = Depends(get_db),
    admin: AdminDetails = Depends(get_current),
):
    return await user_operator.modify_user_with_template(db, username, modify_template_user, admin)


@router.post("s/bulk/expire", summary="Bulk sum/sub to expire of users", response_description="Success confirmation")
async def bulk_modify_users_expire(
    bulk_model: BulkUser,
    db: AsyncSession = Depends(get_db),
    _: AdminDetails = Depends(check_sudo_admin),
):
    """
    Bulk expire users based on the provided criteria.

    - **amount**: amount to adjust the user's quota (in seconds, positive to increase, negative to decrease) required
    - **user_ids**: Optional list of user IDs to modify
    - **admins**: Optional list of admin IDs — their users will be targeted
    - **status**: Optional status to filter users (e.g., "expired", "active"), Empty means no filtering
    - **group_ids**: Optional list of group IDs to filter users by their group membership
    """
    return await user_operator.bulk_modify_expire(db, bulk_model)


@router.post(
    "s/bulk/data_limit", summary="Bulk sum/sub to data limit of users", response_description="Success confirmation"
)
async def bulk_modify_users_datalimit(
    bulk_model: BulkUser,
    db: AsyncSession = Depends(get_db),
    _: AdminDetails = Depends(check_sudo_admin),
):
    """
    Bulk modify users' data limit based on the provided criteria.

    - **amount**: amount to adjust the user's quota (positive to increase, negative to decrease) required
    - **user_ids**: Optional list of user IDs to modify
    - **admins**: Optional list of admin IDs — their users will be targeted
    - **status**: Optional status to filter users (e.g., "expired", "active"), Empty means no filtering
    - **group_ids**: Optional list of group IDs to filter users by their group membership
    """
    return await user_operator.bulk_modify_datalimit(db, bulk_model)


@router.post(
    "s/bulk/proxy_settings", summary="Bulk modify users proxy settings", response_description="Success confirmation"
)
async def bulk_modify_users_proxy_settings(
    bulk_model: BulkUsersProxy,
    db: AsyncSession = Depends(get_db),
    _: AdminDetails = Depends(check_sudo_admin),
):
    return await user_operator.bulk_modify_proxy_settings(db, bulk_model)

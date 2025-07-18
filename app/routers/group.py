from fastapi import APIRouter, Depends, status

from app.db import AsyncSession, get_db
from app.models.admin import AdminDetails
from app.models.group import BulkGroup, GroupCreate, GroupModify, GroupResponse, GroupsResponse
from app.operation import OperatorType
from app.operation.group import GroupOperation
from app.utils import responses

from .authentication import check_sudo_admin, get_current

router = APIRouter(prefix="/api/group", tags=["Groups"], responses={401: responses._401, 403: responses._403})
group_operator = GroupOperation(OperatorType.API)


@router.post(
    "",
    response_model=GroupResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Create a new group",
    description="Creates a new group in the system. Only sudo administrators can create groups.",
)
async def create_group(
    new_group: GroupCreate, db: AsyncSession = Depends(get_db), admin: AdminDetails = Depends(check_sudo_admin)
):
    """
    Create a new group in the system.

    The group model has the following properties:
    - **name**: String (3-64 chars) containing only a-z and 0-9
    - **inbound_tags**: List of inbound tags that this group can access
    - **is_disabled**: Boolean flag to disable/enable the group

    Returns:
        GroupResponse: The created group data with additional fields:
            - **id**: Unique identifier for the group
            - **total_users**: Number of users in this group

    Raises:
        401: Unauthorized - If not authenticated
        403: Forbidden - If not sudo admin
    """
    return await group_operator.create_group(db, new_group, admin)


@router.get(
    "s",
    response_model=GroupsResponse,
    summary="List all groups",
    description="Retrieves a paginated list of all groups in the system. Requires admin authentication.",
)
async def get_all_groups(
    offset: int = None, limit: int = None, db: AsyncSession = Depends(get_db), _: AdminDetails = Depends(get_current)
):
    """
    Retrieve a list of all groups with optional pagination.

    The response includes:
    - **groups**: List of GroupResponse objects containing:
        - **id**: Unique identifier
        - **name**: Group name
        - **inbound_tags**: List of allowed inbound tags
        - **is_disabled**: Group status
        - **total_users**: Number of users in group
    - **total**: Total count of groups

    Returns:
        GroupsResponse: List of groups and total count

    Raises:
        401: Unauthorized - If not authenticated
    """
    return await group_operator.get_all_groups(db, offset, limit)


@router.get(
    "/{group_id}",
    response_model=GroupResponse,
    summary="Get group details",
    description="Retrieves detailed information about a specific group by its ID.",
    responses={404: responses._404},
)
async def get_group(group_id: int, db: AsyncSession = Depends(get_db), _: AdminDetails = Depends(get_current)):
    """
    Get a specific group by its **ID**.

    The response includes:
    - **id**: Unique identifier
    - **name**: Group name (3-64 chars, a-z, 0-9)
    - **inbound_tags**: List of allowed inbound tags
    - **is_disabled**: Group status
    - **total_users**: Number of users in group

    Returns:
        GroupResponse: The requested group data

    Raises:
        404: Not Found - If group doesn't exist
    """
    return await group_operator.get_validated_group(db, group_id)


@router.put(
    "/{group_id}",
    response_model=GroupResponse,
    summary="Modify group",
    description="Updates an existing group's information. Only sudo administrators can modify groups.",
    responses={404: responses._404},
)
async def modify_group(
    group_id: int,
    modified_group: GroupModify,
    db: AsyncSession = Depends(get_db),
    admin: AdminDetails = Depends(check_sudo_admin),
):
    """
    Modify an existing group's information.

    The group model can be modified with:
    - **name**: String (3-64 chars) containing only a-z and 0-9
    - **inbound_tags**: List of inbound tags that this group can access
    - **is_disabled**: Boolean flag to disable/enable the group

    Returns:
        GroupResponse: The modified group data with additional fields:
            - **id**: Unique identifier for the group
            - **total_users**: Number of users in this group

    Raises:
        401: Unauthorized - If not authenticated
        403: Forbidden - If not sudo admin
        404: Not Found - If group doesn't exist
    """
    return await group_operator.modify_group(db, group_id, modified_group, admin)


@router.delete(
    "/{group_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Remove group",
    description="Deletes a group from the system. Only sudo administrators can delete groups.",
    responses={404: responses._404},
)
async def remove_group(
    group_id: int, db: AsyncSession = Depends(get_db), admin: AdminDetails = Depends(check_sudo_admin)
):
    """
    Remove a group by its **ID**.

    Returns:
        dict: Empty dictionary on successful deletion

    Raises:
        401: Unauthorized - If not authenticated
        403: Forbidden - If not sudo admin
        404: Not Found - If group doesn't exist
    """
    await group_operator.remove_group(db, group_id, admin)
    return {}


@router.post(
    "s/bulk/add",
    summary="Bulk add groups to users",
    response_description="Success confirmation",
)
async def bulk_add_groups_to_users(
    bulk_group: BulkGroup, db: AsyncSession = Depends(get_db), _: AdminDetails = Depends(get_current)
):
    """
    Bulk assign groups to multiple users, users under specific admins, or all users.

    - **group_ids**: List of group IDs to add (required)
    - **users**: Optional list of user IDs to assign the groups to
    - **admins**: Optional list of admin IDs — their users will be targeted

    Notes:
    - If neither 'users' nor 'admins' are provided, groups will be added to *all users*
    - Existing user-group associations will be ignored (no duplication)
    - Returns list of affected users (those who received new group associations)
    """
    return await group_operator.bulk_add_groups(db, bulk_group)


@router.post(
    "s/bulk/remove",
    summary="Bulk remove groups from users",
    response_description="Success confirmation",
)
async def bulk_remove_users_from_groups(
    bulk_group: BulkGroup, db: AsyncSession = Depends(get_db), _: AdminDetails = Depends(get_current)
):
    """
    Bulk remove groups from multiple users, users under specific admins, or all users.

    - **group_ids**: List of group IDs to remove (required)
    - **users**: Optional list of user IDs to remove the groups from
    - **admins**: Optional list of admin IDs — their users will be targeted

    Notes:
    - If neither 'users' nor 'admins' are provided, groups will be removed from *all users*
    - Only existing user-group associations will be removed
    - Returns list of affected users (those who had groups removed)
    """
    return await group_operator.bulk_remove_groups(db, bulk_group)

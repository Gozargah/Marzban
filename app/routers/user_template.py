from fastapi import Depends, APIRouter, status

from app.db import AsyncSession, get_db
from app.models.admin import AdminDetails
from .authentication import check_sudo_admin, get_current
from app.models.user_template import UserTemplateCreate, UserTemplateModify, UserTemplateResponse
from app.operation import OperatorType
from app.operation.user_template import UserTemplateOperation
from app.utils import responses


router = APIRouter(tags=["User Template"], prefix="/api/user_template")
template_operator = UserTemplateOperation(OperatorType.API)


@router.post(
    "", response_model=UserTemplateResponse, status_code=status.HTTP_201_CREATED, responses={403: responses._403}
)
async def create_user_template(
    new_user_template: UserTemplateCreate,
    db: AsyncSession = Depends(get_db),
    admin: AdminDetails = Depends(check_sudo_admin),
):
    """
    Create a new user template

    - **name** can be up to 64 characters
    - **data_limit** must be in bytes and larger or equal to 0
    - **expire_duration** must be in seconds and larger or equat to 0
    - **group_ids** list of group ids
    """
    return await template_operator.create_user_template(db, new_user_template, admin)


@router.get("/{template_id}", response_model=UserTemplateResponse)
async def get_user_template(
    template_id: int, db: AsyncSession = Depends(get_db), _: AdminDetails = Depends(get_current)
):
    """Get User Template information with id"""
    return await template_operator.get_validated_user_template(db, template_id)


@router.put("/{template_id}", response_model=UserTemplateResponse, responses={403: responses._403})
async def modify_user_template(
    template_id: int,
    modify_user_template: UserTemplateModify,
    db: AsyncSession = Depends(get_db),
    admin: AdminDetails = Depends(check_sudo_admin),
):
    """
    Modify User Template

    - **name** can be up to 64 characters
    - **data_limit** must be in bytes and larger or equal to 0
    - **expire_duration** must be in seconds and larger or equat to 0
    - **group_ids** list of group ids
    """
    return await template_operator.modify_user_template(db, template_id, modify_user_template, admin)


@router.delete("/{template_id}", status_code=status.HTTP_204_NO_CONTENT, responses={403: responses._403})
async def remove_user_template(
    template_id: int, db: AsyncSession = Depends(get_db), admin: AdminDetails = Depends(check_sudo_admin)
):
    """Remove a User Template by its ID"""
    await template_operator.remove_user_template(db, template_id, admin)
    return {}


@router.get("s", response_model=list[UserTemplateResponse])
async def get_user_templates(
    offset: int = None, limit: int = None, db: AsyncSession = Depends(get_db), _: AdminDetails = Depends(get_current)
):
    """Get a list of User Templates with optional pagination"""
    return await template_operator.get_user_templates(db, offset, limit)

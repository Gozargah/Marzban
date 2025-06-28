from typing import Union, List

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models import UserTemplate
from app.models.user_template import UserTemplateCreate, UserTemplateModify

from .group import get_groups_by_ids


async def load_user_template_attrs(template: UserTemplate):
    await template.awaitable_attrs.groups


async def create_user_template(db: AsyncSession, user_template: UserTemplateCreate) -> UserTemplate:
    """
    Creates a new user template in the database.

    Args:
        db (AsyncSession): Database session.
        user_template (UserTemplateCreate): The user template creation data.

    Returns:
        UserTemplate: The created user template object.
    """

    db_user_template = UserTemplate(
        name=user_template.name,
        data_limit=user_template.data_limit,
        expire_duration=user_template.expire_duration,
        username_prefix=user_template.username_prefix,
        username_suffix=user_template.username_suffix,
        groups=await get_groups_by_ids(db, user_template.group_ids) if user_template.group_ids else None,
        extra_settings=user_template.extra_settings.dict() if user_template.extra_settings else None,
        status=user_template.status,
        reset_usages=user_template.reset_usages,
        on_hold_timeout=user_template.on_hold_timeout,
        is_disabled=user_template.is_disabled,
        data_limit_reset_strategy=user_template.data_limit_reset_strategy,
    )

    db.add(db_user_template)
    await db.commit()
    await db.refresh(db_user_template)
    await load_user_template_attrs(db_user_template)
    return db_user_template


async def modify_user_template(
    db: AsyncSession, db_user_template: UserTemplate, modified_user_template: UserTemplateModify
) -> UserTemplate:
    """
    Updates a user template's details.

    Args:
        db (AsyncSession): Database session.
        db_user_template (UserTemplate): The user template object to be updated.
        modified_user_template (UserTemplateModify): The modified user template data.

    Returns:
        UserTemplate: The updated user template object.
    """
    if modified_user_template.name is not None:
        db_user_template.name = modified_user_template.name
    if modified_user_template.data_limit is not None:
        db_user_template.data_limit = modified_user_template.data_limit
    if modified_user_template.expire_duration is not None:
        db_user_template.expire_duration = modified_user_template.expire_duration
    if modified_user_template.username_prefix is not None:
        db_user_template.username_prefix = modified_user_template.username_prefix
    if modified_user_template.username_suffix is not None:
        db_user_template.username_suffix = modified_user_template.username_suffix
    if modified_user_template.group_ids:
        db_user_template.groups = await get_groups_by_ids(db, modified_user_template.group_ids)
    if modified_user_template.extra_settings is not None:
        db_user_template.extra_settings = modified_user_template.extra_settings.dict()
    if modified_user_template.status is not None:
        db_user_template.status = modified_user_template.status
    if modified_user_template.reset_usages is not None:
        db_user_template.reset_usages = modified_user_template.reset_usages
    if modified_user_template.on_hold_timeout is not None:
        db_user_template.on_hold_timeout = modified_user_template.on_hold_timeout
    if modified_user_template.is_disabled is not None:
        db_user_template.is_disabled = modified_user_template.is_disabled
    if modified_user_template.data_limit_reset_strategy is not None:
        db_user_template.data_limit_reset_strategy = modified_user_template.data_limit_reset_strategy

    await db.commit()
    await db.refresh(db_user_template)
    await load_user_template_attrs(db_user_template)
    return db_user_template


async def remove_user_template(db: AsyncSession, db_user_template: UserTemplate):
    """
    Removes a user template from the database.

    Args:
        db (AsyncSession): Database session.
        db_user_template (UserTemplate): The user template object to be removed.
    """
    await db.delete(db_user_template)
    await db.commit()


async def get_user_template(db: AsyncSession, user_template_id: int) -> UserTemplate:
    """
    Retrieves a user template by its ID.

    Args:
        db (AsyncSession): Database session.
        user_template_id (int): The ID of the user template.

    Returns:
        UserTemplate: The user template object.
    """
    user_template = (
        (await db.execute(select(UserTemplate).where(UserTemplate.id == user_template_id)))
        .unique()
        .scalar_one_or_none()
    )
    if user_template:
        await load_user_template_attrs(user_template)
    return user_template


async def get_user_templates(
    db: AsyncSession, offset: Union[int, None] = None, limit: Union[int, None] = None
) -> List[UserTemplate]:
    """
    Retrieves a list of user templates with optional pagination.

    Args:
        db (AsyncSession): Database session.
        offset (Union[int, None]): The number of records to skip (for pagination).
        limit (Union[int, None]): The maximum number of records to return.

    Returns:
        List[UserTemplate]: A list of user template objects.
    """
    query = select(UserTemplate)
    if offset:
        query = query.offset(offset)
    if limit:
        query = query.limit(limit)

    user_templates = (await db.execute(query)).scalars().all()
    for template in user_templates:
        await load_user_template_attrs(template)

    return user_templates

from datetime import datetime as dt, timezone as tz
from typing import Optional

from sqlalchemy import and_, case, cast, delete, func, or_, select, text, update
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.base import DATABASE_DIALECT
from app.db.models import (
    Admin,
    Group,
    NextPlan,
    NodeUserUsage,
    User,
    UserStatus,
    UserUsageResetLogs,
    users_groups_association,
)
from app.models.group import BulkGroup
from app.models.user import BulkUser, BulkUsersProxy

from .general import get_datetime_add_expression
from .user import load_user_attrs


async def reset_all_users_data_usage(db: AsyncSession, admin: Optional[Admin] = None):
    """
    Efficiently resets data usage for all users, or users under a specific admin if provided.

    This function performs a high-performance reset by executing bulk database operations
    rather than iterating over ORM-mapped objects, improving speed and reducing memory usage.

    Operations performed:
        - Sets `used_traffic` to 0 for all target users.
        - Sets `status` to `active` for all users, unless filtered by admin.
        - Deletes all related `UserUsageResetLogs`, `NodeUserUsage`, and `NextPlan` entries.

    Args:
        db (AsyncSession): The SQLAlchemy async session used for database operations.
        admin (Optional[Admin]): If provided, only resets data usage for users belonging to this admin.
                                 If None, resets usage for all users in the system.

    Notes:
        - All operations are executed in bulk for performance.
        - This function assumes proper foreign key constraints and cascading rules are in place.
        - The function commits changes at the end of the operation.
    """
    user_ids_query = select(User.id).where(User.admin_id == admin.id) if admin else select(User.id)
    user_ids = (await db.execute(user_ids_query)).scalars().all()

    if not user_ids:
        return

    await db.execute(update(User).where(User.id.in_(user_ids)).values(used_traffic=0, status=UserStatus.active))

    await db.execute(delete(UserUsageResetLogs).where(UserUsageResetLogs.user_id.in_(user_ids)))
    await db.execute(delete(NodeUserUsage).where(NodeUserUsage.user_id.in_(user_ids)))
    await db.execute(delete(NextPlan).where(NextPlan.user_id.in_(user_ids)))

    await db.commit()


async def disable_all_active_users(db: AsyncSession, admin: Admin | None = None):
    """
    Disable all active users or users under a specific admin.

    Args:
        db (AsyncSession): Database session.
        admin (Optional[Admin]): Admin to filter users by, if any.
    """
    query = update(User).where(User.status.in_((UserStatus.active, UserStatus.on_hold)))
    if admin:
        query = query.filter(User.admin_id == admin.id)

    await db.execute(
        query.values(
            {User.status: UserStatus.disabled, User.last_status_change: dt.now(tz.utc)},
        )
    )

    await db.commit()
    await db.refresh(admin)


async def activate_all_disabled_users(db: AsyncSession, admin: Admin | None = None):
    """
    Activate all disabled users or users under a specific admin.

    Args:
        db (AsyncSession): Database session.
        admin (Optional[Admin]): Admin to filter users by, if any.
    """
    query_for_active_users = update(User).where(User.status == UserStatus.disabled)
    query_for_on_hold_users = update(User).where(
        and_(
            User.status == UserStatus.disabled,
            User.expire.is_(None),
            User.on_hold_expire_duration.isnot(None),
        )
    )
    if admin:
        query_for_active_users = query_for_active_users.where(User.admin_id == admin.id)
        query_for_on_hold_users = query_for_on_hold_users.where(User.admin_id == admin.id)

    await db.execute(
        query_for_on_hold_users.values(
            {User.status: UserStatus.on_hold, User.last_status_change: dt.now(tz.utc)},
        )
    )
    await db.execute(
        query_for_active_users.values(
            {User.status: UserStatus.active, User.last_status_change: dt.now(tz.utc)},
        )
    )

    await db.commit()
    await db.refresh(admin)


def _create_group_filter(bulk_model: BulkGroup):
    """Create a comprehensive SQLAlchemy filter condition from a BulkGroup model."""
    other_conditions = []
    if bulk_model.admins:
        other_conditions.append(User.admin_id.in_(bulk_model.admins))
    if bulk_model.has_group_ids:
        other_conditions.append(User.groups.any(Group.id.in_(bulk_model.has_group_ids)))

    user_ids = bulk_model.users or []

    filter_conditions = []
    if user_ids:
        filter_conditions.append(User.id.in_(user_ids))
    if other_conditions:
        filter_conditions.append(and_(*other_conditions))

    if len(filter_conditions) > 1:
        return or_(*filter_conditions)
    elif filter_conditions:
        return filter_conditions[0]
    else:
        return True


async def add_groups_to_users(db: AsyncSession, bulk_model: BulkGroup) -> tuple[list, int] | tuple[list[User], int]:
    """
    Bulk add groups to users and return list of affected User objects.
    """
    final_filter = _create_group_filter(bulk_model)

    # Get target user IDs
    result = await db.execute(select(User.id).where(final_filter))
    user_ids = {row[0] for row in result.all()}

    count_effctive_users = len(user_ids)

    if not user_ids:
        return [], count_effctive_users

    # Fetch existing associations for target users
    existing = await db.execute(
        select(users_groups_association).where(users_groups_association.c.user_id.in_(user_ids))
    )
    existing_pairs = {(r.user_id, r.groups_id) for r in existing.all()}

    # Prepare new associations
    new_rows = [
        {"user_id": uid, "groups_id": gid}
        for uid in user_ids
        for gid in bulk_model.group_ids
        if (uid, gid) not in existing_pairs
    ]

    if not new_rows:
        return [], count_effctive_users

    await db.execute(users_groups_association.insert(), new_rows)
    await db.commit()

    # Return users that actually had groups added
    result = await db.execute(select(User).where(User.id.in_({r["user_id"] for r in new_rows})))
    users = result.scalars().all()
    for user in users:
        await load_user_attrs(user)
    return users, count_effctive_users


async def remove_groups_from_users(
    db: AsyncSession, bulk_model: BulkGroup
) -> tuple[list, int] | tuple[list[User], int]:
    """
    Bulk remove groups from users and return list of affected User objects.
    """
    final_filter = _create_group_filter(bulk_model)

    # Get target user IDs
    result = await db.execute(select(User.id).where(final_filter))
    user_ids = {row[0] for row in result.all()}

    count_effctive_users = len(user_ids)

    if not user_ids:
        return [], count_effctive_users

    # Identify affected users (those who actually have the groups to be removed)
    subquery = (
        select(users_groups_association.c.user_id)
        .where(
            and_(
                users_groups_association.c.user_id.in_(user_ids),
                users_groups_association.c.groups_id.in_(bulk_model.group_ids),
            )
        )
        .distinct()
    )
    result = await db.execute(select(User).where(User.id.in_(subquery)))
    users = result.scalars().all()

    if not users:
        return [], count_effctive_users

    await db.execute(
        delete(users_groups_association).where(
            users_groups_association.c.user_id.in_([u.id for u in users]),
            users_groups_association.c.groups_id.in_(bulk_model.group_ids),
        )
    )
    await db.commit()
    for user in users:
        await load_user_attrs(user)
    return users, count_effctive_users


def _create_final_filter(bulk_model: BulkUser | BulkUsersProxy):
    """Create a comprehensive SQLAlchemy filter condition from a bulk model."""
    other_conditions = []
    if hasattr(bulk_model, "status") and bulk_model.status:
        other_conditions.append(User.status.in_([i.value for i in bulk_model.status]))
    if bulk_model.admins:
        other_conditions.append(User.admin_id.in_([i for i in bulk_model.admins]))
    if bulk_model.group_ids:
        other_conditions.append(User.groups.any(Group.id.in_(bulk_model.group_ids)))

    user_ids = bulk_model.users or []

    filter_conditions = []
    if user_ids:
        filter_conditions.append(User.id.in_(user_ids))
    if other_conditions:
        filter_conditions.append(and_(*other_conditions))

    if len(filter_conditions) > 1:
        return or_(*filter_conditions)
    elif filter_conditions:
        return filter_conditions[0]
    else:
        return True


async def update_users_expire(db: AsyncSession, bulk_model: BulkUser) -> tuple[list[User], int] | tuple[list, int]:
    """
    Bulk update user expiration dates and return list of User objects where status changed.
    """
    final_filter = _create_final_filter(bulk_model)

    count_effctive_users = (
        await db.execute(select(func.count(User.id)).where(and_(final_filter, User.expire.isnot(None))))
    ).scalar_one_or_none() or 0
    # Get database-specific datetime addition expression
    new_expire = get_datetime_add_expression(User.expire, bulk_model.amount)
    current_time = dt.now(tz.utc)

    # First, get the users that will have status changes BEFORE updating
    status_change_conditions = or_(
        and_(new_expire <= current_time, User.status == UserStatus.active),
        and_(new_expire > current_time, User.status == UserStatus.expired),
    )

    # Get IDs of users whose status will change
    result = await db.execute(
        select(User.id).where(and_(final_filter, User.expire.isnot(None), status_change_conditions))
    )
    status_changed_user_ids = [row[0] for row in result.fetchall()]

    # Perform the update
    status_cases = [
        (and_(new_expire <= current_time, User.status == UserStatus.active), UserStatus.expired),
        (and_(new_expire > current_time, User.status == UserStatus.expired), UserStatus.active),
    ]

    await db.execute(
        update(User)
        .where(and_(final_filter, User.expire.isnot(None)))
        .values(expire=new_expire, status=case(*status_cases, else_=User.status))
    )
    await db.commit()

    # Return the users whose status changed
    if status_changed_user_ids:
        result = await db.execute(select(User).where(User.id.in_(status_changed_user_ids)))
        users = result.scalars().all()
        for user in users:
            await load_user_attrs(user)
        return users, count_effctive_users
    return [], count_effctive_users


async def update_users_datalimit(db: AsyncSession, bulk_model: BulkUser) -> tuple[list[User], int] | tuple[list, int]:
    """
    Bulk update user data limits and return list of User objects where status changed.
    """
    final_filter = _create_final_filter(bulk_model)

    count_effctive_users = (
        await db.execute(
            select(func.count(User.id)).where(and_(final_filter, User.data_limit.isnot(None), User.data_limit != 0))
        )
    ).scalar_one_or_none() or 0

    # First, get the users that will have status changes BEFORE updating
    status_change_conditions = or_(
        and_(User.data_limit + bulk_model.amount <= User.used_traffic, User.status == UserStatus.active),
        and_(User.data_limit + bulk_model.amount > User.used_traffic, User.status == UserStatus.limited),
    )

    # Get IDs of users whose status will change
    result = await db.execute(
        select(User.id).where(
            and_(final_filter, User.data_limit.isnot(None), User.data_limit != 0, status_change_conditions)
        )
    )
    status_changed_user_ids = [row[0] for row in result.fetchall()]

    # Perform the update
    status_cases = [
        (
            and_(User.data_limit + bulk_model.amount <= User.used_traffic, User.status == UserStatus.active),
            UserStatus.limited,
        ),
        (
            and_(User.data_limit + bulk_model.amount > User.used_traffic, User.status == UserStatus.limited),
            UserStatus.active,
        ),
    ]

    await db.execute(
        update(User)
        .where(and_(final_filter, User.data_limit.isnot(None), User.data_limit != 0))
        .values(data_limit=User.data_limit + bulk_model.amount, status=case(*status_cases, else_=User.status))
    )

    await db.commit()

    # Return the users whose status changed
    if status_changed_user_ids:
        result = await db.execute(select(User).where(User.id.in_(status_changed_user_ids)))
        users = result.scalars().all()
        for user in users:
            await load_user_attrs(user)
        return users, count_effctive_users
    return [], count_effctive_users


async def update_users_proxy_settings(
    db: AsyncSession, bulk_model: BulkUsersProxy
) -> tuple[list, int] | tuple[list[User], int]:
    """
    Bulk update the `proxy_settings` JSON field for users and return updated rows.
    """
    final_filter = _create_final_filter(bulk_model)

    # First select the users that will be updated
    select_stmt = select(User).where(final_filter)
    result = await db.execute(select_stmt)
    users_to_update = result.scalars().all()
    count_effctive_users = len(users_to_update)

    if not users_to_update:
        return [], count_effctive_users

    # Prepare the update statement
    if DATABASE_DIALECT == "postgresql":
        proxy_settings_expr = cast(User.proxy_settings, JSONB)
        if bulk_model.flow is not None:
            proxy_settings_expr = func.jsonb_set(
                proxy_settings_expr,
                text("'{vless,flow}'"),
                cast(f"{bulk_model.flow.value}", JSONB),
                True,
            )
        if bulk_model.method is not None:
            proxy_settings_expr = func.jsonb_set(
                proxy_settings_expr,
                text("'{shadowsocks,method}'"),
                cast(f"{bulk_model.method.value}", JSONB),
                True,
            )
    else:
        proxy_settings_expr = User.proxy_settings
        if bulk_model.flow is not None:
            proxy_settings_expr = func.json_set(proxy_settings_expr, "$.vless.flow", f"{bulk_model.flow.value}")
        if bulk_model.method is not None:
            proxy_settings_expr = func.json_set(
                proxy_settings_expr, "$.shadowsocks.method", f"{bulk_model.method.value}"
            )

    # Perform the update
    update_stmt = update(User).where(final_filter).values(proxy_settings=proxy_settings_expr)
    await db.execute(update_stmt)
    await db.commit()

    # Refresh the user objects to get updated values
    for user in users_to_update:
        await db.refresh(user)
        await load_user_attrs(user)

    return users_to_update, count_effctive_users

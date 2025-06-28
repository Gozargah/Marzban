from typing import List, Optional
from datetime import datetime as dt, timezone as tz

from sqlalchemy import select, and_, delete, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models import Admin, User, UserStatus, NextPlan, UserUsageResetLogs, NodeUserUsage, users_groups_association
from app.models.group import BulkGroup

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


async def _resolve_target_user_ids(db: AsyncSession, bulk_model: BulkGroup) -> set[int]:
    """Resolve all user IDs based on users/admins or return all users if unspecified."""
    user_ids = set()

    if bulk_model.users:
        result = await db.execute(select(User.id).where(User.id.in_(bulk_model.users)))
        user_ids.update({row[0] for row in result.all()})

    if bulk_model.admins:
        result = await db.execute(select(User.id).where(User.admin_id.in_(bulk_model.admins)))
        user_ids.update({row[0] for row in result.all()})

    return user_ids


async def bulk_add_groups_to_users(db: AsyncSession, bulk_model: BulkGroup) -> List["User"]:
    """
    Bulk add groups to users and return list of affected User objects.
    """
    conditions = [users_groups_association.c.groups_id.in_(bulk_model.group_ids)]

    user_ids = set()
    target_all_users = True

    if bulk_model.users or bulk_model.admins:
        target_all_users = False
        user_ids = await _resolve_target_user_ids(db, bulk_model)
        conditions.append(users_groups_association.c.user_id.in_(user_ids))

    # Fetch existing associations
    existing = await db.execute(
        select(users_groups_association).where(
            and_(*conditions),
        )
    )

    existing_pairs = {(r.user_id, r.groups_id) for r in existing.all()}

    if not existing_pairs:
        return []

    if target_all_users:
        result = await db.execute(select(User.id))
        user_ids = {row[0] for row in result.all()}

    # Prepare new associations
    new_rows = [
        {"user_id": uid, "groups_id": gid}
        for uid in user_ids
        for gid in bulk_model.group_ids
        if (uid, gid) not in existing_pairs
    ]

    if not new_rows:
        return []

    await db.execute(users_groups_association.insert(), new_rows)
    await db.commit()

    result = await db.execute(select(User).where(User.id.in_({r["user_id"] for r in new_rows})))
    users = result.scalars().all()
    for user in users:
        await load_user_attrs(user)
    return users


async def bulk_remove_groups_from_users(db: AsyncSession, bulk_model: BulkGroup) -> List["User"]:
    """
    Bulk remove groups from users and return list of affected User objects.
    """
    conditions = [users_groups_association.c.groups_id.in_(bulk_model.group_ids)]

    if bulk_model.users or bulk_model.admins:
        user_ids = await _resolve_target_user_ids(db, bulk_model)
        conditions.append(users_groups_association.c.user_id.in_(user_ids))

    # Identify affected users
    result = await db.execute(
        select(User)
        .distinct()
        .join(users_groups_association, User.id == users_groups_association.c.user_id)
        .where(and_(*conditions))
    )
    users = result.scalars().all()

    if not users:
        return []

    await db.execute(
        delete(users_groups_association).where(
            users_groups_association.c.user_id.in_([u.id for u in users]),
            users_groups_association.c.groups_id.in_(bulk_model.group_ids),
        )
    )
    await db.commit()
    for user in users:
        await load_user_attrs(user)
    return users

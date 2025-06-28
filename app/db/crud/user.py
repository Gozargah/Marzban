import asyncio
from copy import deepcopy
from datetime import datetime, timezone, timedelta, UTC
from enum import Enum
from typing import Optional, List, Union

from sqlalchemy import select, or_, and_, func, not_, delete
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import joinedload
from sqlalchemy.sql.functions import coalesce

from app.db.models import (
    User,
    UserStatus,
    Admin,
    UserDataLimitResetStrategy,
    Group,
    NotificationReminder,
    ReminderType,
    NodeUserUsage,
    NextPlan,
    UserUsageResetLogs,
)
from app.models.proxy import ProxyTable
from app.models.stats import Period, UserUsageStatsList, UserUsageStat
from app.models.user import UserCreate, UserModify
from config import USERS_AUTODELETE_DAYS

from .general import build_json_proxy_settings_search_condition, _build_trunc_expression
from .group import get_groups_by_ids


async def load_user_attrs(user: User):
    await user.awaitable_attrs.admin
    await user.awaitable_attrs.next_plan
    await user.awaitable_attrs.usage_logs
    await user.awaitable_attrs.groups


async def get_user(db: AsyncSession, username: str) -> Optional[User]:
    """
    Retrieves a user by username.

    Args:
        db (AsyncSession): Database session.
        username (str): The username of the user.

    Returns:
        Optional[User]: The user object if found, else None.
    """
    stmt = select(User).where(User.username == username)

    user = (await db.execute(stmt)).unique().scalar_one_or_none()
    if user:
        await load_user_attrs(user)
    return user


async def get_user_by_id(db: AsyncSession, user_id: int) -> User | None:
    """
    Retrieves a user by user ID.

    Args:
        db (AsyncSession): Database session.
        user_id (int): The ID of the user.

    Returns:
        Optional[User]: The user object if found, else None.
    """
    stmt = select(User).where(User.id == user_id)

    user = (await db.execute(stmt)).unique().scalar_one_or_none()
    if user:
        await load_user_attrs(user)
    return user


UsersSortingOptions = Enum(
    "UsersSortingOptions",
    {
        "username": User.username.asc(),
        "used_traffic": User.used_traffic.asc(),
        "data_limit": User.data_limit.asc(),
        "expire": User.expire.asc(),
        "created_at": User.created_at.asc(),
        "-username": User.username.desc(),
        "-used_traffic": User.used_traffic.desc(),
        "-data_limit": User.data_limit.desc(),
        "-expire": User.expire.desc(),
        "-created_at": User.created_at.desc(),
    },
)


async def get_users(
    db: AsyncSession,
    offset: int | None = None,
    limit: int | None = None,
    usernames: list[str] | None = None,
    search: str | None = None,
    proxy_id: str | None = None,
    status: UserStatus | list[UserStatus] | None = None,
    sort: list[UsersSortingOptions] | None = None,
    admin: Admin | None = None,
    admins: list[str] | None = None,
    reset_strategy: UserDataLimitResetStrategy | list[UserDataLimitResetStrategy] | None = None,
    return_with_count: bool = False,
    group_ids: list[int] | None = None,
) -> list[User] | tuple[list[User], int]:
    """
    Retrieves users based on various filters.

    Args:
        db: Database session.
        offset: Number of records to skip.
        limit: Number of records to retrieve.
        usernames: List of usernames to filter by.
        search: Search term for username.
        status: User status filter (single status or list).
        sort: Sort options.
        admin: Admin filter.
        admins: List of admin usernames to filter by.
        reset_strategy: Reset strategy filter (single strategy or list).
        return_with_count: Whether to return total count.
        group_ids: Filter users by their group IDs.

    Returns:
        List of users or tuple with (users, count) if return_with_count is True.
    """
    stmt = select(User)

    filters = []
    if usernames:
        filters.append(User.username.in_(usernames))
    if search:
        filters.append(or_(User.username.ilike(f"%{search}%"), User.note.ilike(f"%{search}%")))

    if status:
        if isinstance(status, list):
            filters.append(User.status.in_(status))
        else:
            filters.append(User.status == status)
    if admin:
        filters.append(User.admin_id == admin.id)
    if admins:
        stmt = stmt.join(User.admin).filter(Admin.username.in_(admins))
    if reset_strategy:
        if isinstance(reset_strategy, list):
            filters.append(User.data_limit_reset_strategy.in_(reset_strategy))
        else:
            filters.append(User.data_limit_reset_strategy == reset_strategy)

    if group_ids:
        filters.append(User.groups.any(Group.id.in_(group_ids)))
    if proxy_id:
        filters.append(build_json_proxy_settings_search_condition(User.proxy_settings, proxy_id))

    if filters:
        stmt = stmt.where(and_(*filters))

    if sort:
        stmt = stmt.order_by(*sort)

    total = None
    if return_with_count:
        count_stmt = select(func.count()).select_from(stmt.subquery())
        result = await db.execute(count_stmt)
        total = result.scalar()

    if offset:
        stmt = stmt.offset(offset)
    if limit:
        stmt = stmt.limit(limit)

    result = await db.execute(stmt)
    users = list(result.unique().scalars().all())

    for user in users:
        await load_user_attrs(user)

    if return_with_count:
        return users, total
    return users


async def get_expired_users(
    db: AsyncSession,
    expired_after: datetime | None = None,
    expired_before: datetime | None = None,
    admin_id: int | None = None,
):
    query = select(User).where(User.status.in_([UserStatus.limited, UserStatus.expired])).where(User.is_expired)
    if expired_after:
        query = query.where(User.expire >= expired_after)
    if expired_before:
        query = query.where(User.expire <= expired_before)
    if admin_id:
        query = query.where(User.admin_id == admin_id)

    return (await db.execute(query)).unique().scalars().all()


async def get_active_to_expire_users(db: AsyncSession) -> list[User]:
    stmt = select(User).where(User.status == UserStatus.active).where(User.is_expired)

    users = list((await db.execute(stmt)).unique().scalars().all())
    for user in users:
        await load_user_attrs(user)
    return users


async def get_active_to_limited_users(db: AsyncSession) -> list[User]:
    stmt = select(User).where(User.status == UserStatus.active).where(User.is_limited)

    users = list((await db.execute(stmt)).unique().scalars().all())
    for user in users:
        await load_user_attrs(user)
    return users


async def get_on_hold_to_active_users(db: AsyncSession) -> list[User]:
    stmt = select(User).where(User.status == UserStatus.on_hold).where(User.become_online)

    users = list((await db.execute(stmt)).unique().scalars().all())
    for user in users:
        await load_user_attrs(user)
    return users


async def get_usage_percentage_reached_users(db: AsyncSession, percentage: int) -> list[User]:
    """
    Get active users who have reached or exceeded the specified usage percentage threshold
    and don't have an existing notification reminder for this threshold.
    """
    # Subquery to check for existing notification reminders
    existing_reminder_subq = (
        select(NotificationReminder.user_id)
        .where(
            NotificationReminder.user_id == User.id,
            NotificationReminder.type == ReminderType.data_usage,
            NotificationReminder.threshold == percentage,
        )
        .exists()
    )

    stmt = (
        select(User)
        .options(joinedload(User.notification_reminders))
        .where(User.status == UserStatus.active)
        .where(User.usage_percentage >= percentage)
        .where(not_(existing_reminder_subq))  # Only users without existing reminders
    )

    users = list((await db.execute(stmt)).unique().scalars().all())
    for user in users:
        await load_user_attrs(user)
    return users


async def get_days_left_reached_users(db: AsyncSession, days: int) -> list[User]:
    """
    Get active users who have reached or exceeded the specified days left threshold
    and don't have an existing notification reminder for this threshold.
    """
    # Subquery to check for existing notification reminders
    existing_reminder_subq = (
        select(NotificationReminder.user_id)
        .where(
            NotificationReminder.user_id == User.id,
            NotificationReminder.type == ReminderType.expiration_date,
            NotificationReminder.threshold == days,
        )
        .exists()
    )

    stmt = (
        select(User)
        .options(joinedload(User.notification_reminders))
        .where(User.status == UserStatus.active)
        .where(User.expire.isnot(None))
        .where(User.days_left <= days)
        .where(not_(existing_reminder_subq))  # Only users without existing reminders
    )

    users = list((await db.execute(stmt)).unique().scalars().all())
    for user in users:
        await load_user_attrs(user)
    return users


async def get_user_usages(
    db: AsyncSession, user_id: int, start: datetime, end: datetime, period: Period, node_id: int | None = None
) -> UserUsageStatsList:
    """
    Retrieves user usages within a specified date range.
    """

    # Build the appropriate truncation expression
    trunc_expr = _build_trunc_expression(period, NodeUserUsage.created_at)

    conditions = [
        NodeUserUsage.created_at >= start,
        NodeUserUsage.created_at <= end,
        NodeUserUsage.user_id == user_id,
    ]

    if node_id is not None:
        conditions.append(NodeUserUsage.node_id == node_id)

    stmt = (
        select(trunc_expr.label("period_start"), func.sum(NodeUserUsage.used_traffic).label("total_traffic"))
        .where(and_(*conditions))
        .group_by(trunc_expr)
        .order_by(trunc_expr)
    )

    result = await db.execute(stmt)
    return UserUsageStatsList(
        period=period, start=start, end=end, stats=[UserUsageStat(**row) for row in result.mappings()]
    )


async def get_users_count(db: AsyncSession, status: UserStatus = None, admin: Admin = None) -> int:
    """
    Gets the total count of users with optional filters.

    Args:
        db (AsyncSession): Database session.
        status (UserStatus, optional): Filter by user status.
        admin (Admin, optional): Filter by admin.
    Returns:
        int: Total count of users.
    """
    stmt = select(func.count(User.id))

    filters = []
    if status:
        filters.append(User.status == status)
    if admin:
        filters.append(User.admin_id == admin.id)

    if filters:
        stmt = stmt.where(and_(*filters))

    result = await db.execute(stmt)
    return result.scalar()


async def create_user(db: AsyncSession, new_user: UserCreate, groups: list[Group], admin: Admin) -> User:
    """
    Creates a new user.

    Args:
        db (AsyncSession): Database session.
        new_user (UserCreate): User creation data.
        groups (list[Group]): Groups to assign to user.
        admin (Admin): Admin creating the user.

    Returns:
        User: Created user object.
    """
    db_user = User(**new_user.model_dump(exclude={"group_ids", "expire", "proxy_settings", "next_plan"}))
    db_user.admin = admin
    db_user.groups = groups
    db_user.expire = new_user.expire or None
    db_user.proxy_settings = new_user.proxy_settings.dict()
    db_user.next_plan = NextPlan(**new_user.next_plan.model_dump()) if new_user.next_plan else None

    db.add(db_user)
    await db.commit()
    await db.refresh(db_user)
    await load_user_attrs(db_user)
    return db_user


async def remove_user(db: AsyncSession, db_user: User) -> User:
    """
    Removes a user from the database.

    Args:
        db (AsyncSession): Database session.
        db_user (User): User to remove.

    Returns:
        User: Removed user object.
    """
    await db.delete(db_user)
    await db.commit()
    return db_user


async def remove_users(db: AsyncSession, db_users: list[User]):
    """
    Removes multiple users from the database.

    Args:
        db (AsyncSession): Database session.
        dbusers (list[User]): List of user objects to be removed.
    """

    await asyncio.gather(*[db.delete(user) for user in db_users])
    await db.commit()


async def modify_user(db: AsyncSession, db_user: User, modify: UserModify) -> User:
    """
    Modify a user's information.

    Args:
        db (AsyncSession): Database session.
        dbuser (User): User to update.
        modify (UserModify): Modified user data.

    Returns:
        User: Updated user object.
    """
    remove_usage_reminder = False
    remove_expiration_reminder = False

    if modify.proxy_settings:
        db_user.proxy_settings = modify.proxy_settings.dict()
    if modify.group_ids:
        db_user.groups = await get_groups_by_ids(db, modify.group_ids)

    if modify.status is not None:
        db_user.status = modify.status

    if modify.status is UserStatus.on_hold:
        db_user.expire = None
        remove_expiration_reminder = True

    elif modify.expire == 0:
        db_user.expire = None
        remove_expiration_reminder = True
        if db_user.status is UserStatus.expired:
            db_user.status = UserStatus.active

    elif modify.expire is not None:
        db_user.expire = modify.expire
        if db_user.status in [UserStatus.active, UserStatus.expired]:
            if not db_user.expire or db_user.expire.replace(tzinfo=timezone.utc) > datetime.now(timezone.utc):
                db_user.status = UserStatus.active

                remove_expiration_reminder = True
            else:
                db_user.status = UserStatus.expired

    if modify.data_limit is not None:
        db_user.data_limit = modify.data_limit or None
        if db_user.status not in [UserStatus.expired, UserStatus.disabled]:
            if not db_user.data_limit or db_user.used_traffic < db_user.data_limit:
                if db_user.status != UserStatus.on_hold:
                    db_user.status = UserStatus.active

                remove_usage_reminder = True
            else:
                db_user.status = UserStatus.limited

    if modify.note is not None:
        db_user.note = modify.note or None

    if modify.data_limit_reset_strategy is not None:
        db_user.data_limit_reset_strategy = modify.data_limit_reset_strategy.value

    if modify.on_hold_timeout == 0:
        db_user.on_hold_timeout = None
    elif modify.on_hold_timeout is not None:
        db_user.on_hold_timeout = modify.on_hold_timeout

    if modify.on_hold_expire_duration is not None:
        db_user.on_hold_expire_duration = modify.on_hold_expire_duration

    if modify.next_plan is not None:
        db_user.next_plan = NextPlan(
            user_id=db_user.id,
            user_template_id=modify.next_plan.user_template_id,
            data_limit=modify.next_plan.data_limit,
            expire=modify.next_plan.expire,
            add_remaining_traffic=modify.next_plan.add_remaining_traffic,
        )
    elif db_user.next_plan is not None:
        await db.delete(db_user.next_plan)

    db_user.edit_at = datetime.now(timezone.utc)

    if remove_usage_reminder or remove_expiration_reminder:
        id = db_user.id
        usage_percentage = db_user.usage_percentage
        days_left = db_user.days_left

    if remove_usage_reminder:
        await delete_user_passed_notification_reminders(db, id, ReminderType.data_usage, usage_percentage)
    if remove_expiration_reminder:
        await delete_user_passed_notification_reminders(db, id, ReminderType.expiration_date, days_left)

    await db.commit()
    await db.refresh(db_user)
    await load_user_attrs(db_user)
    return db_user


async def reset_user_data_usage(db: AsyncSession, db_user: User) -> User:
    """
    Resets the data usage of a user and logs the reset.

    Args:
        db (AsyncSession): Database session.
        dbuser (User): The user object whose data usage is to be reset.

    Returns:
        User: The updated user object.
    """
    await db_user.awaitable_attrs.node_usages
    usage_log = UserUsageResetLogs(
        user_id=db_user.id,
        used_traffic_at_reset=db_user.used_traffic,
    )
    db.add(usage_log)

    db_user.used_traffic = 0
    db_user.node_usages.clear()
    if db_user.status not in [UserStatus.expired, UserStatus.disabled]:
        db_user.status = UserStatus.active.value

    if db_user.next_plan:
        await db.delete(db_user.next_plan)
        db_user.next_plan = None

    await db.commit()
    await db.refresh(db_user)
    await load_user_attrs(db_user)
    return db_user


async def reset_user_by_next(db: AsyncSession, db_user: User) -> User:
    """
    Resets the data usage of a user based on next user.

    Args:
        db (AsyncSession): Database session.
        dbuser (User): The user object whose data usage is to be reset.

    Returns:
        User: The updated user object.
    """
    await db_user.awaitable_attrs.node_usages
    usage_log = UserUsageResetLogs(
        user_id=db_user.id,
        used_traffic_at_reset=db_user.used_traffic,
    )
    db.add(usage_log)

    db_user.node_usages.clear()
    db_user.status = UserStatus.active

    if db_user.next_plan.user_template_id is None:
        db_user.data_limit = db_user.next_plan.data_limit + (
            0 if not db_user.next_plan.add_remaining_traffic else db_user.data_limit or 0 - db_user.used_traffic
        )
        db_user.expire = (
            timedelta(seconds=db_user.next_plan.expire) + datetime.now(UTC) if db_user.next_plan.expire else None
        )
    else:
        await db_user.next_plan.awaitable_attrs.user_template
        await db_user.next_plan.user_template.awaitable_attrs.groups
        db_user.groups = db_user.next_plan.user_template.groups
        db_user.data_limit = db_user.next_plan.user_template.data_limit + (
            0 if not db_user.next_plan.add_remaining_traffic else db_user.data_limit or 0 - db_user.used_traffic
        )
        if db_user.next_plan.user_template.status is UserStatus.on_hold:
            db_user.status = UserStatus.on_hold
            db_user.on_hold_expire_duration = db_user.next_plan.user_template.expire_duration
            db_user.on_hold_timeout = db_user.next_plan.user_template.on_hold_timeout
            db_user.expire = None
        else:
            db_user.expire = (
                timedelta(seconds=db_user.next_plan.user_template.expire_duration) + datetime.now(UTC)
                if db_user.next_plan.user_template.expire_duration
                else None
            )

        proxy_settings = deepcopy(db_user.proxy_settings)
        proxy_settings["vless"]["flow"] = db_user.next_plan.user_template.extra_settings["flow"]
        proxy_settings["shadowsocks"]["method"] = db_user.next_plan.user_template.extra_settings["method"]
        db_user.proxy_settings = proxy_settings
        db_user.data_limit_reset_strategy = db_user.next_plan.user_template.data_limit_reset_strategy

    db_user.used_traffic = 0
    await db.delete(db_user.next_plan)
    db_user.next_plan = None

    await db.commit()
    await db.refresh(db_user)
    await load_user_attrs(db_user)
    return db_user


async def revoke_user_sub(db: AsyncSession, db_user: User) -> User:
    """
    Revokes the subscription of a user and updates proxies settings.

    Args:
        db (AsyncSession): Database session.
        db_user (User): The user object whose subscription is to be revoked.

    Returns:
        User: The updated user object.
    """
    db_user.sub_revoked_at = datetime.now(timezone.utc)

    db_user.proxy_settings = ProxyTable().dict()

    await db.commit()
    await db.refresh(db_user)
    await load_user_attrs(db_user)
    return db_user


async def update_user_sub(db: AsyncSession, db_user: User, user_agent: str) -> User:
    """
    Updates the user's subscription details.

    Args:
        db (AsyncSession): Database session.
        dbuser (User): The user object whose subscription is to be updated.
        user_agent (str): The user agent string to update.

    Returns:
        User: The updated user object.
    """
    db_user.sub_updated_at = datetime.now(timezone.utc)
    db_user.sub_last_user_agent = user_agent

    await db.commit()
    await db.refresh(db_user)
    await load_user_attrs(db_user)
    return db_user


async def autodelete_expired_users(db: AsyncSession, include_limited_users: bool = False) -> List[User]:
    """
    Deletes expired (optionally also limited) users whose auto-delete time has passed.

    Args:
        db (AsyncSession): Database session
        include_limited_users (bool, optional): Whether to delete limited users as well.
            Defaults to False.

    Returns:
        list[User]: List of deleted users.
    """
    target_status = [UserStatus.expired] if not include_limited_users else [UserStatus.expired, UserStatus.limited]

    auto_delete = coalesce(User.auto_delete_in_days, USERS_AUTODELETE_DAYS)

    query = (
        select(
            User,
            auto_delete,  # Use global auto-delete days as fallback
        )
        .where(
            auto_delete >= 0,  # Negative values prevent auto-deletion
            User.status.in_(target_status),
        )
        .options(joinedload(User.admin))
    )

    expired_users = [
        user
        for (user, auto_delete) in (await db.execute(query)).unique()
        if user.last_status_change.replace(tzinfo=timezone.utc) + timedelta(days=auto_delete)
        <= datetime.now(timezone.utc)
    ]

    if expired_users:
        await remove_users(db, expired_users)

    return expired_users


async def get_all_users_usages(
    db: AsyncSession,
    admin: str,
    start: datetime,
    end: datetime,
    period: Period = Period.hour,
    node_id: int | None = None,
) -> UserUsageStatsList:
    """
    Retrieves aggregated usage data for all users of an admin within a specified time range,
    grouped by the specified time period.

    Args:
        db (AsyncSession): Database session for querying.
        admin (Admin): The admin user for which to retrieve user usage data.
        start (datetime): Start of the period.
        end (datetime): End of the period.
        period (Period): Time period to group by ('minute', 'hour', 'day', 'month').
        node_id (Optional[int]): Filter results by specific node ID if provided

    Returns:
        UserUsageStatsList: Aggregated usage data for each period.
    """
    admin_users = {user.id for user in await get_users(db=db, admins=admin)}

    # Build the appropriate truncation expression
    trunc_expr = _build_trunc_expression(period, NodeUserUsage.created_at)

    conditions = [
        NodeUserUsage.created_at >= start,
        NodeUserUsage.created_at <= end,
        NodeUserUsage.user_id.in_(admin_users),
    ]

    if node_id is not None:
        conditions.append(NodeUserUsage.node_id == node_id)

    stmt = (
        select(trunc_expr.label("period_start"), func.sum(NodeUserUsage.used_traffic).label("total_traffic"))
        .where(and_(*conditions))
        .group_by(trunc_expr)
        .order_by(trunc_expr)
    )

    result = await db.execute(stmt)
    return UserUsageStatsList(
        period=period, start=start, end=end, stats=[UserUsageStat(**row) for row in result.mappings()]
    )


async def _update_user_status(db_user: User, status: UserStatus) -> User:
    """
    Updates a user's status and records the time of change.

    Args:
        db_user (User): The user to update.
        status (UserStatus): The new status.

    Returns:
        User: The updated user object.
    """
    db_user.status = status
    db_user.last_status_change = datetime.now(timezone.utc)
    return db_user


async def update_user_status(db: AsyncSession, db_user: User, status: UserStatus) -> User:
    """
    Updates a user status and records the time of change.

    Args:
        db (AsyncSession): Database session.
        db_user (User): The user to update.
        status (UserStatus): The new status.

    Returns:
        User: The updated user object.
    """
    db_user = await _update_user_status(db_user, status)
    await db.commit()
    await db.refresh(db_user)
    await load_user_attrs(db_user)
    return db_user


async def update_users_status(db: AsyncSession, users: list[User], status: UserStatus) -> list[User]:
    """
    Updates a users status and records the time of change.

    Args:
        db (AsyncSession): Database session.
        users list[User]: The users list to update.
        status (UserStatus): The new status.

    Returns:
        User: The updated user object.
    """
    updated_users = await asyncio.gather(*[_update_user_status(user, status) for user in users])
    await db.commit()
    for user in updated_users:
        await db.refresh(user)
        await load_user_attrs(user)
    return users


async def set_owner(db: AsyncSession, db_user: User, admin: Admin) -> User:
    """
    Sets the owner (admin) of a user.

    Args:
        db (AsyncSession): Database session.
        dbuser (User): The user object whose owner is to be set.
        admin (Admin): The admin to set as owner.

    Returns:
        User: The updated user object.
    """
    db_user.admin = admin
    await db.commit()
    await db.refresh(db_user)
    await load_user_attrs(db_user)
    return db_user


async def _start_user_expire(db_user: User) -> User:
    """
    Starts the expiration timer for a user.

    Args:
        db (AsyncSession): Database session.
        dbuser (User): The user object whose expiration timer is to be started.

    Returns:
        User: The updated user object.
    """
    db_user.expire = datetime.now(timezone.utc) + timedelta(seconds=db_user.on_hold_expire_duration)
    db_user.on_hold_expire_duration = None
    db_user.on_hold_timeout = None
    db_user.status = UserStatus.active

    return db_user


async def start_user_expire(db: AsyncSession, db_user: User) -> User:
    """
    Starts the expiration timer for a user.

    Args:
        db (AsyncSession): Database session.
        db_user (User): The user object whose expiration timer is to be started.

    Returns:
        User: The updated user object.
    """
    db_user = await _start_user_expire(db_user)

    await db.commit()
    await db.refresh(db_user)
    await load_user_attrs(db_user)
    return db_user


async def start_users_expire(db: AsyncSession, users: list[User]) -> list[User]:
    """
    Starts the expiration timer for a user.

    Args:
        db (AsyncSession): Database session.
        users list[User]: The users list whose expiration timer is to be started.

    Returns:
        list[User]: The updated users list.
    """
    updated_users = await asyncio.gather(*[_start_user_expire(user) for user in users])

    await db.commit()
    for user in updated_users:
        await db.refresh(user)
        await load_user_attrs(user)
    return users


async def create_notification_reminder(
    db: AsyncSession, reminder_type: ReminderType, expires_at: datetime, user_id: int, threshold: int | None = None
) -> NotificationReminder:
    """
    Creates a new notification reminder.

    Args:
        db (AsyncSession): The database session.
        reminder_type (app.db.models.ReminderType): The type of reminder.
        expires_at (datetime): The expiration time of the reminder.
        user_id (int): The ID of the user associated with the reminder.
        threshold (Optional[int]): The threshold value to check for (e.g., days left or usage percent).

    Returns:
        NotificationReminder: The newly created NotificationReminder object.
    """
    reminder = NotificationReminder(type=reminder_type, expires_at=expires_at, user_id=user_id)
    if threshold is not None:
        reminder.threshold = threshold
    db.add(reminder)
    await db.commit()
    await db.refresh(reminder)
    return reminder


async def get_notification_reminder(
    db: AsyncSession, user_id: int, reminder_type: ReminderType, threshold: Optional[int] = None
) -> Union[NotificationReminder, None]:
    """
    Retrieves a notification reminder for a user.

    Args:
        db (AsyncSession): The database session.
        user_id (int): The ID of the user.
        reminder_type (app.db.models.ReminderType): The type of reminder to retrieve.
        threshold (Optional[int]): The threshold value to check for (e.g., days left or usage percent).

    Returns:
        Union[NotificationReminder, None]: The NotificationReminder object if found and not expired, None otherwise.
    """
    query = select(NotificationReminder).where(
        NotificationReminder.user_id == user_id, NotificationReminder.type == reminder_type
    )

    # If a threshold is provided, filter for reminders with this threshold
    if threshold is not None:
        query = query.where(NotificationReminder.threshold == threshold)

    reminder = (await db.execute(query)).scalar_one_or_none()

    if reminder is None:
        return None

    # Check if the reminder has expired
    if reminder.expires_at and reminder.expires_at.replace(tzinfo=timezone.utc) < datetime.now(timezone.utc):
        await db.delete(reminder)
        await db.commit()
        return None

    return reminder


async def delete_notification_reminder_by_type(
    db: AsyncSession, user_id: int, reminder_type: ReminderType, threshold: Optional[int] = None
) -> None:
    """
    Deletes a notification reminder for a user based on the reminder type and optional threshold.

    Args:
        db (AsyncSession): The database session.
        user_id (int): The ID of the user.
        reminder_type (app.db.models.ReminderType): The type of reminder to delete.
        threshold (Optional[int]): The threshold to delete (e.g., days left or usage percent). If not provided, deletes all reminders of that type.
    """
    stmt = delete(NotificationReminder).where(
        NotificationReminder.user_id == user_id, NotificationReminder.type == reminder_type
    )

    # If a threshold is provided, include it in the filter
    if threshold is not None:
        stmt = stmt.where(NotificationReminder.threshold == threshold)

    await db.execute(stmt)
    await db.commit()


async def delete_user_passed_notification_reminders(
    db: AsyncSession, user_id: int, type: ReminderType, threshold: int
) -> None:
    """
    Deletes user reminders passed.

    Args:
        db (AsyncSession): The database session.
        user_id (int): The ID of the user.
        reminder_type (ReminderType): The type of reminder to delete.
        threshold (int): The threshold to delete (e.g., days left or usage percent).
    """
    conditions = [NotificationReminder.user_id == user_id, NotificationReminder.type == type]

    if type == ReminderType.data_usage:
        conditions.append(NotificationReminder.threshold > threshold)
    if type == ReminderType.expiration_date:
        conditions.append(NotificationReminder.threshold < threshold)

    stmt = delete(NotificationReminder).where(and_(*conditions))
    await db.execute(stmt)
    await db.commit()


async def delete_notification_reminder(db: AsyncSession, db_reminder: NotificationReminder) -> None:
    """
    Deletes a specific notification reminder.

    Args:
        db (AsyncSession): The database session.
        db_reminder (NotificationReminder): The NotificationReminder object to delete.
    """
    await db.delete(db_reminder)
    await db.commit()


async def count_online_users(db: AsyncSession, time_delta: timedelta, admin: Admin | None = None):
    """
    Counts the number of users who have been online within the specified time delta.

    Args:
        db (AsyncSession): The database session.
        time_delta (timedelta): The time period to check for online users.
        admin (Admin, optional): Filter by admin.

    Returns:
        int: The number of users who have been online within the specified time period.
    """
    twenty_four_hours_ago = datetime.now(timezone.utc) - time_delta
    query = select(func.count(User.id)).where(User.online_at.isnot(None), User.online_at >= twenty_four_hours_ago)
    if admin and not admin.is_sudo:
        query = query.where(User.admin_id == admin.id)
    return (await db.execute(query)).scalar_one_or_none()

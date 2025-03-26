"""
Functions for managing proxy hosts, users, user templates, nodes, and administrative tasks.
"""

from datetime import UTC, datetime, timedelta, timezone
from enum import Enum
from typing import List, Optional, Tuple, Union

from sqlalchemy import and_, delete, func, select, update
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import Query, joinedload, selectinload
from sqlalchemy.sql.functions import coalesce

from app.db.models import (
    JWT,
    TLS,
    Admin,
    AdminUsageLogs,
    Node,
    NextPlan,
    NodeUsage,
    NodeUserUsage,
    NotificationReminder,
    ProxyHost,
    ProxyInbound,
    System,
    User,
    UserTemplate,
    UserUsageResetLogs,
    NodeStatus,
    Group,
    users_groups_association,
    ReminderType,
    UserStatus,
    UserDataLimitResetStrategy,
)
from app.models.proxy import ProxyTable
from app.models.host import CreateHost
from app.models.admin import AdminPartialModify, AdminCreate, AdminModify
from app.models.group import GroupCreate, GroupModify
from app.models.node import NodeUsageResponse, NodeCreate, NodeModify
from app.models.user import (
    UserModify,
    UserUsageResponse,
    UserCreate,
)
from app.models.user_template import UserTemplateCreate, UserTemplateModify
from app.utils.helpers import calculate_expiration_days, calculate_usage_percent
from config import NOTIFY_DAYS_LEFT, NOTIFY_REACHED_USAGE_PERCENT, USERS_AUTODELETE_DAYS


async def add_default_host(db: AsyncSession, inbound: ProxyInbound):
    """
    Adds a default host to a proxy inbound.

    Args:
        db (AsyncSession): Database session.
        inbound (ProxyInbound): Proxy inbound to add the default host to.
    """
    host = ProxyHost(remark="🚀 Marz ({USERNAME}) [{PROTOCOL} - {TRANSPORT}]", address="{SERVER_IP}", inbound=inbound)
    db.add(host)
    await db.commit()


async def get_or_create_inbound(db: AsyncSession, inbound_tag: str) -> ProxyInbound:
    """
    Retrieves or creates a proxy inbound based on the given tag.

    Args:
        db (AsyncSession): Database session.
        inbound_tag (str): The tag of the inbound.

    Returns:
        ProxyInbound: The retrieved or newly created proxy inbound.
    """
    stmt = select(ProxyInbound).where(ProxyInbound.tag == inbound_tag)
    result = await db.execute(stmt)
    inbound = result.unique().scalar_one_or_none()

    if not inbound:
        inbound = ProxyInbound(tag=inbound_tag)
        db.add(inbound)
        await db.commit()
        await db.refresh(inbound)

    return inbound


ProxyHostSortingOptions = Enum(
    "ProxyHostSortingOptions",
    {
        "priority": ProxyHost.priority.asc(),
        "id": ProxyHost.id.asc(),
        "-priority": ProxyHost.priority.desc(),
        "-id": ProxyHost.id.desc(),
    },
)


async def get_hosts(
    db: AsyncSession,
    offset: Optional[int] = 0,
    limit: Optional[int] = 0,
    sort: ProxyHostSortingOptions = "priority",
) -> list[ProxyHost]:
    """
    Retrieves hosts.

    Args:
        db (AsyncSession): Database session.
        offset (Optional[int]): Number of records to skip.
        limit (Optional[int]): Number of records to retrieve.

    Returns:
        List[ProxyHost]: List of hosts for the inbound.
    """
    stmt = select(ProxyHost).order_by(sort)

    if offset:
        stmt = stmt.offset(offset)
    if limit:
        stmt = stmt.limit(limit)

    result = await db.execute(stmt)
    return list(result.scalars().all())


async def get_host_by_id(db: AsyncSession, id: int) -> ProxyHost:
    """
    Retrieves host by id.

    Args:
        db (AsyncSession): Database session.
        id (int): The ID of the host.

    Returns:
        ProxyHost: The host if found.
    """
    stmt = select(ProxyHost).where(ProxyHost.id == id)
    result = await db.execute(stmt)
    return result.scalar_one_or_none()


async def add_host(db: AsyncSession, new_host: CreateHost) -> ProxyHost:
    """
    Creates a proxy Host based on the host.

    Args:
        db (AsyncSession): Database session.
        host (CreateHost): The new host to add.

    Returns:
        ProxyHost: The retrieved or newly created proxy host.
    """
    db_host = ProxyHost(**new_host.model_dump(exclude={"inbound_tag", "id"}))
    db_host.inbound = await get_or_create_inbound(db, new_host.inbound_tag)

    db.add(db_host)
    await db.commit()
    await db.refresh(db_host)
    return db_host


async def modify_host(db: AsyncSession, db_host: ProxyHost, modified_host: CreateHost) -> ProxyHost:
    node_data = modified_host.model_dump(exclude={"id"})

    for key, value in node_data.items():
        setattr(db_host, key, value)

    await db.commit()
    await db.refresh(db_host)
    return db_host


async def remove_host(db: AsyncSession, db_host: ProxyHost) -> ProxyHost:
    """
    Removes a proxy Host from the database.

    Args:
        db (AsyncSession): Database session.
        db_host (ProxyHost): The host to remove.

    Returns:
        ProxyHost: The removed proxy host.
    """
    await db.delete(db_host)
    await db.commit()
    return db_host


def get_user_queryset() -> Query:
    return select(User).options(
        selectinload(User.admin),
        selectinload(User.next_plan),
        selectinload(User.usage_logs),
        selectinload(User.groups),
    )


async def get_user(db: AsyncSession, username: str) -> Optional[User]:
    """
    Retrieves a user by username.

    Args:
        db (AsyncSession): Database session.
        username (str): The username of the user.

    Returns:
        Optional[User]: The user object if found, else None.
    """
    stmt = get_user_queryset().where(User.username == username)

    result = await db.execute(stmt)
    return result.unique().scalar_one_or_none()


async def get_user_by_id(db: AsyncSession, user_id: int) -> User | None:
    """
    Retrieves a user by user ID.

    Args:
        db (AsyncSession): Database session.
        user_id (int): The ID of the user.

    Returns:
        Optional[User]: The user object if found, else None.
    """
    stmt = get_user_queryset().where(User.id == user_id)
    result = await db.execute(stmt)
    return result.unique().scalar_one_or_none()


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
    offset: Optional[int] = None,
    limit: Optional[int] = None,
    usernames: Optional[List[str]] = None,
    search: Optional[str] = None,
    status: Optional[Union[UserStatus, list]] = None,
    sort: Optional[List[UsersSortingOptions]] = None,
    admin: Optional[Admin] = None,
    admins: Optional[List[str]] = None,
    reset_strategy: Optional[Union[UserDataLimitResetStrategy, list]] = None,
    return_with_count: bool = False,
) -> Union[List[User], Tuple[List[User], int]]:
    """
    Retrieves users based on various filters.

    Args:
        db (AsyncSession): Database session.
        offset (Optional[int]): Number of records to skip.
        limit (Optional[int]): Number of records to retrieve.
        usernames (Optional[List[str]]): List of usernames to filter by.
        search (Optional[str]): Search term for username.
        status (Optional[Union[app.db.models.UserStatus, list]]): User status filter.
        sort (Optional[List[UsersSortingOptions]]): Sort options.
        admin (Optional[Admin]): Admin filter.
        admins (Optional[List[str]]): List of admin usernames to filter by.
        reset_strategy (Optional[Union[app.db.models.UserDataLimitResetStrategy, list]]): Reset strategy filter.
        return_with_count (bool): Whether to return total count.

    Returns:
        Union[List[User], Tuple[List[User], int]]: List of users or tuple with count.
    """
    stmt = get_user_queryset()

    filters = []
    if usernames:
        filters.append(User.username.in_(usernames))
    if search:
        filters.append(User.username.ilike(f"%{search}%"))
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

    if return_with_count:
        return users, total
    return users


def expired_users_query(
    expired_after: datetime | None = None, expired_before: datetime | None = None, admin_id: int | None = None
):
    query = select(User.username, User.id).where(
        User.status.in_([UserStatus.limited, UserStatus.expired]), User.expire.isnot(None)
    )
    if expired_after:
        query = query.where(User.expire >= expired_after)
    if expired_before:
        query = query.where(User.expire <= expired_before)
    if admin_id:
        query = query.where(User.admin_id == admin_id)
    return query


async def get_expired_users_ids(
    db: AsyncSession,
    expired_after: datetime | None = None,
    expired_before: datetime | None = None,
    admin_id: int | None = None,
) -> list[str]:
    query = select(User.id).where(User.status.in_([UserStatus.limited, UserStatus.expired]), User.expire.isnot(None))
    if expired_after:
        query = query.where(User.expire >= expired_after)
    if expired_before:
        query = query.where(User.expire <= expired_before)
    if admin_id:
        query = query.where(User.admin_id == admin_id)

    result = await db.execute(query)
    return [row[0] for row in result.all()]


async def get_expired_users_username(
    db: AsyncSession,
    expired_after: datetime | None = None,
    expired_before: datetime | None = None,
    admin_id: int | None = None,
) -> list[str]:
    query = select(User.username).where(
        User.status.in_([UserStatus.limited, UserStatus.expired]), User.expire.isnot(None)
    )
    if expired_after:
        query = query.where(User.expire >= expired_after)
    if expired_before:
        query = query.where(User.expire <= expired_before)
    if admin_id:
        query = query.where(User.admin_id == admin_id)

    query = expired_users_query(expired_after, expired_before, admin_id)

    result = await db.execute(query)
    return [row[0] for row in result.all()]


async def delete_expired_users(
    db: AsyncSession,
    expired_after: datetime | None = None,
    expired_before: datetime | None = None,
    admin_id: int | None = None,
) -> tuple[list[str], int]:
    usernames_to_delete = await get_expired_users_username(db, expired_after, expired_before, admin_id)
    user_ids_to_delete = await get_expired_users_ids(db, expired_after, expired_before, admin_id)

    if not user_ids_to_delete:
        return [], 0

    delete_association_stmt = users_groups_association.delete().where(
        users_groups_association.c.user_id.in_(user_ids_to_delete)
    )
    await db.execute(delete_association_stmt)

    delete_users_stmt = delete(User).where(User.id.in_(user_ids_to_delete))
    result = await db.execute(delete_users_stmt)
    await db.commit()

    return usernames_to_delete, result.rowcount


async def get_user_usages(db: AsyncSession, dbuser: User, start: datetime, end: datetime) -> List[UserUsageResponse]:
    """
    Retrieves user usages within a specified date range.

    Args:
        db (AsyncSession): Database session.
        dbuser (User): The user object.
        start (datetime): Start date for usage retrieval.
        end (datetime): End date for usage retrieval.

    Returns:
        List[UserUsageResponse]: List of user usage responses.
    """

    usages = {
        0: UserUsageResponse(  # Main Core
            node_id=None, node_name="Master", used_traffic=0
        )
    }

    for node in await db.query(Node).all():
        usages[node.id] = UserUsageResponse(node_id=node.id, node_name=node.name, used_traffic=0)

    cond = and_(NodeUserUsage.user_id == dbuser.id, NodeUserUsage.created_at >= start, NodeUserUsage.created_at <= end)

    for v in await db.query(NodeUserUsage).filter(cond):
        try:
            usages[v.node_id or 0].used_traffic += v.used_traffic
        except KeyError:
            pass

    return list(usages.values())


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
    return await get_user(db, username=new_user.username)


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


async def remove_users(db: AsyncSession, dbusers: List[User]):
    """
    Removes multiple users from the database.

    Args:
        db (AsyncSession): Database session.
        dbusers (List[User]): List of user objects to be removed.
    """
    for dbuser in dbusers:
        await db.delete(dbuser)
    await db.commit()


async def update_user(db: AsyncSession, db_user: User, modify: UserModify) -> User:
    """
    Updates a user's information.

    Args:
        db (AsyncSession): Database session.
        dbuser (User): User to update.
        modify (UserModify): Modified user data.

    Returns:
        User: Updated user object.
    """
    if modify.proxy_settings:
        db_user.proxy_settings = modify.proxy_settings.dict()
    if modify.group_ids:
        db_user.groups = await get_groups_by_ids(db, modify.group_ids)

    if modify.status is not None:
        db_user.status = modify.status

    if modify.data_limit is not None:
        db_user.data_limit = modify.data_limit or None
        if db_user.status not in [UserStatus.expired, UserStatus.disabled]:
            if not db_user.data_limit or db_user.used_traffic < db_user.data_limit:
                if db_user.status != UserStatus.on_hold:
                    db_user.status = UserStatus.active

                for percent in sorted(NOTIFY_REACHED_USAGE_PERCENT, reverse=True):
                    if not db_user.data_limit or (
                        calculate_usage_percent(db_user.used_traffic, db_user.data_limit) < percent
                    ):
                        reminder = await get_notification_reminder(
                            db, db_user.id, ReminderType.data_usage, threshold=percent
                        )
                        if reminder:
                            await delete_notification_reminder(db, reminder)

            else:
                db_user.status = UserStatus.limited

    if modify.expire == 0:
        db_user.expire = None
        if db_user.status is UserStatus.expired:
            db_user.status = UserStatus.active

    elif modify.expire is not None:
        db_user.expire = modify.expire
        if db_user.status in [UserStatus.active, UserStatus.expired]:
            if not db_user.expire or db_user.expire.replace(tzinfo=timezone.utc) > datetime.now(timezone.utc):
                db_user.status = UserStatus.active
                for days_left in sorted(NOTIFY_DAYS_LEFT):
                    if not db_user.expire or (calculate_expiration_days(db_user.expire) > days_left):
                        reminder = await get_notification_reminder(
                            db, db_user.id, ReminderType.expiration_date, threshold=days_left
                        )
                        if reminder:
                            await delete_notification_reminder(db, reminder)
            else:
                db_user.status = UserStatus.expired

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
            user_template_id=modify.next_plan.user_template_id,
            data_limit=modify.next_plan.data_limit,
            expire=modify.next_plan.expire,
            add_remaining_traffic=modify.next_plan.add_remaining_traffic,
            fire_on_either=modify.next_plan.fire_on_either,
        )
    elif db_user.next_plan is not None:
        await db.delete(db_user.next_plan)

    db_user.edit_at = datetime.now(timezone.utc)

    await db.commit()
    await db.refresh(db_user)
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
    username = db_user.username
    await db.refresh(db_user, ["node_usages", "next_plan"])
    usage_log = UserUsageResetLogs(
        user=db_user,
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
    return await get_user(db, username)


async def reset_user_by_next(db: AsyncSession, db_user: User) -> User:
    """
    Resets the data usage of a user based on next user.

    Args:
        db (AsyncSession): Database session.
        dbuser (User): The user object whose data usage is to be reset.

    Returns:
        User: The updated user object.
    """
    username = db_user.username
    await db.refresh(db_user, ["node_usages", "next_plan", "data_limit"])

    usage_log = UserUsageResetLogs(
        user=db_user,
        used_traffic_at_reset=db_user.used_traffic,
    )
    db.add(usage_log)

    db_user.node_usages.clear()
    db_user.status = UserStatus.active.value

    if db_user.next_plan.user_template_id is None:
        db_user.data_limit = db_user.next_plan.data_limit + (
            0 if db_user.next_plan.add_remaining_traffic else db_user.data_limit or 0 - db_user.used_traffic
        )
        db_user.expire = timedelta(seconds=db_user.next_plan.expire) + datetime.now(UTC)
    else:
        db_user.groups = db_user.next_plan.user_template.groups
        db_user.data_limit = db_user.next_plan.user_template.data_limit + (
            0 if db_user.next_plan.add_remaining_traffic else db_user.data_limit or 0 - db_user.used_traffic
        )
        db_user.expire = timedelta(seconds=db_user.next_plan.user_template.expire_duration) + datetime.now(UTC)

    db_user.used_traffic = 0
    await db.delete(db_user.next_plan)
    db_user.next_plan = None

    await db.commit()
    return await get_user(db, username)


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
    return db_user


async def update_user_sub(db: AsyncSession, dbuser: User, user_agent: str) -> User:
    """
    Updates the user's subscription details.

    Args:
        db (AsyncSession): Database session.
        dbuser (User): The user object whose subscription is to be updated.
        user_agent (str): The user agent string to update.

    Returns:
        User: The updated user object.
    """
    dbuser.sub_updated_at = datetime.now(timezone.utc)
    dbuser.sub_last_user_agent = user_agent

    await db.commit()


async def reset_all_users_data_usage(db: AsyncSession, admin: Optional[Admin] = None):
    """
    Resets the data usage for all users or users under a specific admin.

    Args:
        db (AsyncSession): Database session.
        admin (Optional[Admin]): Admin to filter users by, if any.
    """
    query = get_user_queryset().options(selectinload(User.node_usages))

    if admin:
        query = query.where(User.admin == admin)

    for dbuser in (await db.execute(query)).scalars().all():
        dbuser.used_traffic = 0
        if dbuser.status not in [UserStatus.on_hold, UserStatus.expired, UserStatus.disabled]:
            dbuser.status = UserStatus.active
        dbuser.usage_logs.clear()
        dbuser.node_usages.clear()
        if dbuser.next_plan:
            await db.delete(dbuser.next_plan)
            dbuser.next_plan = None
        await db.add(dbuser)

    await db.commit()


async def disable_all_active_users(db: AsyncSession, admin_id: int | None = None):
    """
    Disable all active users or users under a specific admin.

    Args:
        db (AsyncSession): Database session.
        admin (Optional[Admin]): Admin to filter users by, if any.
    """
    query = update(User).where(User.status.in_((UserStatus.active, UserStatus.on_hold)))
    if admin_id:
        query = query.filter(User.admin_id == admin_id)

    await db.execute(
        query.values(
            {User.status: UserStatus.disabled, User.last_status_change: datetime.now(timezone.utc)},
        )
    )

    await db.commit()


async def activate_all_disabled_users(db: AsyncSession, admin_id: int | None = None):
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
    if admin_id:
        query_for_active_users = query_for_active_users.where(User.admin_id == admin_id)
        query_for_on_hold_users = query_for_on_hold_users.where(User.admin_id == admin_id)

    await db.execute(
        query_for_on_hold_users.values(
            {User.status: UserStatus.on_hold, User.last_status_change: datetime.now(timezone.utc)},
        )
    )
    await db.execute(
        query_for_active_users.values(
            {User.status: UserStatus.active, User.last_status_change: datetime.now(timezone.utc)},
        )
    )

    await db.commit()


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

    # Add time filter to query
    query = query.where(
        func.date_add(
            User.last_status_change, func.make_interval(days=coalesce(User.auto_delete_in_days, USERS_AUTODELETE_DAYS))
        )
        <= func.now()
    )

    expired_users = [user for (user, _) in (await db.execute(query)).unique()]

    if expired_users:
        await remove_users(db, expired_users)

    return expired_users


async def get_all_users_usages(db: AsyncSession, admin: str, start: datetime, end: datetime) -> list[UserUsageResponse]:
    """
    Retrieves usage data for all users associated with an admin within a specified time range.

    This function calculates the total traffic used by users across different nodes,
    including a "Master" node that represents the main core.

    Args:
        db (AsyncSession): Database session for querying.
        admin (Admin): The admin user for which to retrieve user usage data.
        start (datetime): The start date and time of the period to consider.
        end (datetime): The end date and time of the period to consider.

    Returns:
        List[UserUsageResponse]: A list of UserUsageResponse objects, each representing
        the usage data for a specific node or the main core.
    """
    usages = {
        0: UserUsageResponse(  # Main Core
            node_id=None, node_name="Master", used_traffic=0
        )
    }

    for node in (await db.execute(select(Node))).scalars().all():
        usages[node.id] = UserUsageResponse(node_id=node.id, node_name=node.name, used_traffic=0)

    admin_users = set(user.id for user in await get_users(db=db, admins=admin))

    cond = and_(
        NodeUserUsage.created_at >= start, NodeUserUsage.created_at <= end, NodeUserUsage.user_id.in_(admin_users)
    )

    for v in (await db.execute(select(NodeUserUsage).where(cond))).scalars().all():
        try:
            usages[v.node_id or 0].used_traffic += v.used_traffic
        except KeyError:
            pass

    return list(usages.values())


async def update_user_status(db: AsyncSession, dbuser: User, status: UserStatus) -> User:
    """
    Updates a user's status and records the time of change.

    Args:
        db (AsyncSession): Database session.
        dbuser (User): The user to update.
        status (app.db.models.UserStatus): The new status.

    Returns:
        User: The updated user object.
    """
    dbuser.status = status
    dbuser.last_status_change = datetime.now(timezone.utc)
    await db.commit()


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
    return await get_user(db, db_user.username)


async def start_user_expire(db: AsyncSession, dbuser: User) -> User:
    """
    Starts the expiration timer for a user.

    Args:
        db (AsyncSession): Database session.
        dbuser (User): The user object whose expiration timer is to be started.

    Returns:
        User: The updated user object.
    """
    dbuser.expire = datetime.now(timezone.utc) + timedelta(seconds=dbuser.on_hold_expire_duration)
    dbuser.on_hold_expire_duration = None
    dbuser.on_hold_timeout = None
    await db.commit()


async def get_system_usage(db: AsyncSession) -> System:
    """
    Retrieves system usage information.

    Args:
        db (AsyncSession): Database session.

    Returns:
        System: System usage information.
    """
    return (await db.execute(select(System))).scalar_one_or_none()


async def get_jwt_secret_key(db: AsyncSession) -> str:
    """
    Retrieves the JWT secret key.

    Args:
        db (AsyncSession): Database session.

    Returns:
        str: JWT secret key.
    """
    return (await db.execute(select(JWT))).scalar_one_or_none().secret_key


async def get_tls_certificate(db: AsyncSession) -> TLS:
    """
    Retrieves the TLS certificate.

    Args:
        db (AsyncSession): Database session.

    Returns:
        TLS: TLS certificate information.
    """
    return (await db.execute(select(TLS))).scalar_one_or_none()


def get_admin_queryset() -> Query:
    return select(Admin).options(selectinload(Admin.usage_logs))


async def get_admin(db: AsyncSession, username: str) -> Admin:
    """
    Retrieves an admin by username.

    Args:
        db (AsyncSession): Database session.
        username (str): The username of the admin.

    Returns:
        Admin: The admin object.
    """
    return (await db.execute(get_admin_queryset().where(Admin.username == username))).unique().scalar_one_or_none()


async def create_admin(db: AsyncSession, admin: AdminCreate) -> Admin:
    """
    Creates a new admin in the database.

    Args:
        db (AsyncSession): Database session.
        admin (AdminCreate): The admin creation data.

    Returns:
        Admin: The created admin object.
    """
    db_admin = Admin(**admin.model_dump(exclude={"password"}), hashed_password=admin.hashed_password)
    db.add(db_admin)
    await db.commit()
    await db.refresh(db_admin)  # Ensure the admin object is refreshed after commit
    return db_admin


async def update_admin(db: AsyncSession, db_admin: Admin, modified_admin: AdminModify) -> Admin:
    """
    Updates an admin's details.

    Args:
        db (AsyncSession): Database session.
        dbadmin (Admin): The admin object to be updated.
        modified_admin (AdminModify): The modified admin data.

    Returns:
        Admin: The updated admin object.
    """
    if modified_admin.is_sudo:
        db_admin.is_sudo = modified_admin.is_sudo
    if modified_admin.is_disabled is not None:
        db_admin.is_disabled = modified_admin.is_disabled
    if modified_admin.hashed_password is not None and db_admin.hashed_password != modified_admin.hashed_password:
        db_admin.hashed_password = modified_admin.hashed_password
        db_admin.password_reset_at = datetime.now(timezone.utc)
    if modified_admin.telegram_id:
        db_admin.telegram_id = modified_admin.telegram_id
    if modified_admin.discord_webhook:
        db_admin.discord_webhook = modified_admin.discord_webhook
    if modified_admin.sub_template:
        db_admin.sub_template = modified_admin.sub_template
    if modified_admin.sub_domain:
        db_admin.sub_domain = modified_admin.sub_domain
    if modified_admin.support_url:
        db_admin.support_url = modified_admin.support_url
    if modified_admin.profile_title:
        db_admin.profile_title = modified_admin.profile_title

    await db.commit()
    await db.refresh(db_admin)
    return db_admin


async def partial_update_admin(db: AsyncSession, dbadmin: Admin, modified_admin: AdminPartialModify) -> Admin:
    """
    Partially updates an admin's details.

    Args:
        db (AsyncSession): Database session.
        dbadmin (Admin): The admin object to be updated.
        modified_admin (AdminPartialModify): The modified admin data.

    Returns:
        Admin: The updated admin object.
    """
    if modified_admin.is_sudo is not None:
        dbadmin.is_sudo = modified_admin.is_sudo
    if modified_admin.is_disabled is not None:
        dbadmin.is_disabled = modified_admin.is_disabled
    if modified_admin.password is not None and dbadmin.hashed_password != modified_admin.hashed_password:
        dbadmin.hashed_password = modified_admin.hashed_password
        dbadmin.password_reset_at = datetime.now(timezone.utc)
    if modified_admin.telegram_id is not None:
        dbadmin.telegram_id = modified_admin.telegram_id
    if modified_admin.discord_webhook is not None:
        dbadmin.discord_webhook = modified_admin.discord_webhook
    if modified_admin.sub_template:
        dbadmin.sub_template = modified_admin.sub_template
    if modified_admin.sub_domain:
        dbadmin.sub_domain = modified_admin.sub_domain
    if modified_admin.support_url:
        dbadmin.support_url = modified_admin.support_url
    if modified_admin.profile_title:
        dbadmin.profile_title = modified_admin.profile_title

    await db.commit()
    return await get_admin(db, dbadmin.username)


async def remove_admin(db: AsyncSession, dbadmin: Admin) -> None:
    """
    Removes an admin from the database.

    Args:
        db (AsyncSession): Database session.
        dbadmin (Admin): The admin object to be removed.

    Returns:
        Admin: The removed admin object.
    """
    await db.delete(dbadmin)
    await db.commit()


async def get_admin_by_id(db: AsyncSession, id: int) -> Admin:
    """
    Retrieves an admin by their ID.

    Args:
        db (AsyncSession): Database session.
        id (int): The ID of the admin.

    Returns:
        Admin: The admin object.
    """
    return (await db.execute(get_admin_queryset().where(Admin.id == id))).unique().scalar_one_or_none()


async def get_admin_by_telegram_id(db: AsyncSession, telegram_id: int) -> Admin:
    """
    Retrieves an admin by their Telegram ID.

    Args:
        db (AsyncSession): Database session.
        telegram_id (int): The Telegram ID of the admin.

    Returns:
        Admin: The admin object.
    """
    return (
        (await db.execute(get_admin_queryset().where(Admin.telegram_id == telegram_id))).unique().scalar_one_or_none()
    )


async def get_admins(
    db: AsyncSession, offset: int | None = None, limit: int | None = None, username: str | None = None
) -> list[Admin]:
    """
    Retrieves a list of admins with optional filters and pagination.

    Args:
        db (AsyncSession): Database session.
        offset (Optional[int]): The number of records to skip (for pagination).
        limit (Optional[int]): The maximum number of records to return.
        username (Optional[str]): The username to filter by.

    Returns:
        List[Admin]: A list of admin objects.
    """
    query = get_admin_queryset()
    if username:
        query = query.where(Admin.username.ilike(f"%{username}%"))
    if offset:
        query = query.offset(offset)
    if limit:
        query = query.limit(limit)
    return (await db.execute(query)).scalars().all()


async def reset_admin_usage(db: AsyncSession, db_admin: Admin) -> int:
    """
    Retrieves an admin's usage by their username.
    Args:
        db (AsyncSession): Database session.
        dbadmin (Admin): The admin object to be updated.
    Returns:
        Admin: The updated admin.
    """
    if db_admin.users_usage == 0:
        return db_admin

    usage_log = AdminUsageLogs(admin=db_admin, used_traffic_at_reset=db_admin.users_usage)
    db.add(usage_log)
    db_admin.users_usage = 0

    await db.commit()
    await db.refresh(db_admin)
    return db_admin


def get_user_template_queryset() -> Query:
    return select(UserTemplate).options(selectinload(UserTemplate.groups))


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
    )

    db.add(db_user_template)
    await db.commit()
    await db.refresh(db_user_template)
    return db_user_template


async def update_user_template(
    db: AsyncSession, db_user_template: UserTemplate, modified_user_template: UserTemplateModify
) -> UserTemplate:
    """
    Updates a user template's details.

    Args:
        db (AsyncSession): Database session.
        dbuser_template (UserTemplate): The user template object to be updated.
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

    await db.commit()
    await db.refresh(db_user_template)
    return db_user_template


async def remove_user_template(db: AsyncSession, db_user_template: UserTemplate):
    """
    Removes a user template from the database.

    Args:
        db (AsyncSession): Database session.
        dbuser_template (UserTemplate): The user template object to be removed.
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
    return (
        (await db.execute(get_user_template_queryset().where(UserTemplate.id == user_template_id)))
        .unique()
        .scalar_one_or_none()
    )


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
    dbuser_templates = get_user_template_queryset()
    if offset:
        dbuser_templates = dbuser_templates.offset(offset)
    if limit:
        dbuser_templates = dbuser_templates.limit(limit)

    return (await db.execute(dbuser_templates)).scalars().all()


def get_node_queryset() -> Query:
    return select(Node).options(
        selectinload(Node.user_usages),
        selectinload(Node.usages),
    )


async def get_node(db: AsyncSession, name: str) -> Optional[Node]:
    """
    Retrieves a node by its name.

    Args:
        db (AsyncSession): The database session.
        name (str): The name of the node to retrieve.

    Returns:
        Optional[Node]: The Node object if found, None otherwise.
    """
    return (await db.execute(select(Node).where(Node.name == name))).unique().scalar_one_or_none()


async def get_node_by_id(db: AsyncSession, node_id: int) -> Optional[Node]:
    """
    Retrieves a node by its ID.

    Args:
        db (AsyncSession): The database session.
        node_id (int): The ID of the node to retrieve.

    Returns:
        Optional[Node]: The Node object if found, None otherwise.
    """
    return (await db.execute(select(Node).where(Node.id == node_id))).unique().scalar_one_or_none()


async def get_nodes(
    db: AsyncSession,
    status: Optional[Union[NodeStatus, list]] = None,
    enabled: bool = None,
    offset: int | None = None,
    limit: int | None = None,
) -> list[Node]:
    """
    Retrieves nodes based on optional status and enabled filters.

    Args:
        db (AsyncSession): The database session.
        status (Optional[Union[app.db.models.NodeStatus, list]]): The status or list of statuses to filter by.
        enabled (bool): If True, excludes disabled nodes.

    Returns:
        List[Node]: A list of Node objects matching the criteria.
    """
    query = get_node_queryset()

    if status:
        if isinstance(status, list):
            query = query.where(Node.status.in_(status))
        else:
            query = query.where(Node.status == status)

    if enabled:
        query = query.where(Node.status != NodeStatus.disabled)

    if offset:
        query = query.offset(offset)
    if limit:
        query = query.limit(limit)

    return (await db.execute(query)).scalars().all()


async def get_nodes_usage(db: AsyncSession, start: datetime, end: datetime) -> list[NodeUsageResponse]:
    """
    Retrieves usage data for all nodes within a specified time range.

    Args:
        db (AsyncSession): The database session.
        start (datetime): The start time of the usage period.
        end (datetime): The end time of the usage period.

    Returns:
        List[NodeUsageResponse]: A list of NodeUsageResponse objects containing usage data.
    """
    usages = {
        0: NodeUsageResponse(  # Main Core
            node_id=None, node_name="Master", uplink=0, downlink=0
        )
    }

    for node in (await db.execute(get_node_queryset())).scalars().all():
        usages[node.id] = NodeUsageResponse(node_id=node.id, node_name=node.name, uplink=0, downlink=0)

    cond = and_(NodeUsage.created_at >= start, NodeUsage.created_at <= end)

    for v in (await db.execute(select(NodeUsage).where(cond))).scalars().all():
        try:
            usages[v.node_id or 0].uplink += v.uplink
            usages[v.node_id or 0].downlink += v.downlink
        except KeyError:
            pass

    return list(usages.values())


async def create_node(db: AsyncSession, node: NodeCreate) -> Node:
    """
    Creates a new node in the database.

    Args:
        db (AsyncSession): The database session.
        node (NodeCreate): The node creation model containing node details.

    Returns:
        Node: The newly created Node object.
    """
    db_node = Node(**node.model_dump(exclude={"id"}))

    db.add(db_node)
    await db.commit()
    await db.refresh(db_node)
    return db_node


async def remove_node(db: AsyncSession, db_node: Node) -> Node:
    """
    Removes a node from the database.

    Args:
        db (AsyncSession): The database session.
        dbnode (Node): The Node object to be removed.

    Returns:
        Node: The removed Node object.
    """
    await db.delete(db_node)
    await db.commit()


async def update_node(db: AsyncSession, db_node: Node, modify: NodeModify) -> Node:
    """
    Updates an existing node with new information.

    Args:
        db (AsyncSession): The database session.
        dbnode (Node): The Node object to be updated.
        modify (NodeModify): The modification model containing updated node details.

    Returns:
        Node: The updated Node object.
    """

    node_data = modify.model_dump(exclude={"id"}, exclude_none=True)

    for key, value in node_data.items():
        setattr(db_node, key, value)

    db_node.xray_version = None
    db_node.message = None
    db_node.node_version = None

    if db_node.status != NodeStatus.disabled:
        db_node.status = NodeStatus.connecting

    await db.commit()
    await db.refresh(db_node)
    return db_node


async def update_node_status(
    db: AsyncSession,
    db_node: Node,
    status: NodeStatus,
    message: str = None,
    xray_version: str = None,
    node_version: str = None,
) -> Node:
    """
    Updates the status of a node.

    Args:
        db (AsyncSession): The database session.
        dbnode (Node): The Node object to be updated.
        status (app.db.models.NodeStatus): The new status of the node.
        message (str, optional): A message associated with the status update.
        version (str, optional): The version of the node software.

    Returns:
        Node: The updated Node object.
    """
    db_node.status = status
    db_node.message = message
    db_node.xray_version = xray_version
    db_node.node_version = node_version
    db_node.last_status_change = datetime.now(timezone.utc)
    await db.commit()
    await db.refresh(db_node)
    return db_node


async def create_notification_reminder(
    db: AsyncSession, reminder_type: ReminderType, expires_at: datetime, user_id: int, threshold: Optional[int] = None
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


async def delete_notification_reminder(db: AsyncSession, dbreminder: NotificationReminder) -> None:
    """
    Deletes a specific notification reminder.

    Args:
        db (AsyncSession): The database session.
        dbreminder (NotificationReminder): The NotificationReminder object to delete.
    """
    await db.delete(dbreminder)
    await db.commit()


async def count_online_users(db: AsyncSession, time_delta: timedelta):
    """
    Counts the number of users who have been online within the specified time delta.

    Args:
        db (AsyncSession): The database session.
        time_delta (timedelta): The time period to check for online users.

    Returns:
        int: The number of users who have been online within the specified time period.
    """
    twenty_four_hours_ago = datetime.now(timezone.utc) - time_delta
    query = select(func.count(User.id)).where(User.online_at.isnot(None), User.online_at >= twenty_four_hours_ago)
    return (await db.execute(query)).scalar_one_or_none()


async def get_inbounds_by_tags(db: AsyncSession, tags: list[str]) -> list[ProxyInbound]:
    """
    Retrieves inbounds by their tags.
    """
    return (await db.execute(select(ProxyInbound).where(ProxyInbound.tag.in_(tags)))).scalars().all()


def get_group_queryset() -> Query:
    return select(Group).options(
        selectinload(Group.inbounds),
        selectinload(Group.users),
        selectinload(Group.templates),
    )


async def get_group_by_id(db: AsyncSession, group_id: int) -> Group | None:
    """
    Retrieves a group by its ID.

    Args:
        db (AsyncSession): The database session.
        group_id (int): The ID of the group to retrieve.

    Returns:
        Optional[Group]: The Group object if found, None otherwise.
    """
    return (await db.execute(get_group_queryset().where(Group.id == group_id))).unique().scalar_one_or_none()


async def create_group(db: AsyncSession, group: GroupCreate) -> Group:
    """
    Creates a new group in the database.

    Args:
        db (AsyncSession): The database session.
        group (GroupCreate): The group creation model containing group details.

    Returns:
        Group: The newly created Group object.
    """
    db_group = Group(
        name=group.name,
        inbounds=await get_inbounds_by_tags(db, group.inbound_tags),
        is_disabled=group.is_disabled,
    )
    db.add(db_group)
    await db.commit()
    await db.refresh(db_group, ["id", "name", "is_disabled", "users", "inbounds"])
    return db_group


async def get_group(db: AsyncSession, offset: int = None, limit: int = None) -> tuple[list[Group], int]:
    """
    Retrieves a list of groups with optional pagination.

    Args:
        db (AsyncSession): The database session.
        offset (int, optional): The number of records to skip (for pagination).
        limit (int, optional): The maximum number of records to return.

    Returns:
        tuple: A tuple containing:
            - list[Group]: A list of Group objects
            - int: The total count of groups
    """
    groups = get_group_queryset()
    if offset:
        groups = groups.offset(offset)
    if limit:
        groups = groups.limit(limit)

    all_groups = (await db.execute(groups)).scalars().all()
    return all_groups, len(all_groups)


async def get_groups_by_ids(db: AsyncSession, group_ids: list[int]) -> list[Group]:
    """
    Retrieves a list of groups by their IDs.

    Args:
        db (AsyncSession): The database session.
        group_ids (list[int]): The IDs of the groups to retrieve.

    Returns:
        list[Group]: A list of Group objects.
    """
    return (await db.execute(get_group_queryset().where(Group.id.in_(group_ids)))).scalars().all()


async def update_group(db: AsyncSession, db_group: Group, modified_group: GroupModify) -> Group:
    """
    Updates an existing group with new information.

    Args:
        db (AsyncSession): The database session.
        dbgroup (Group): The Group object to be updated.
        modified_group (GroupModify): The modification model containing updated group details.

    Returns:
        Group: The updated Group object.
    """
    if db_group.name != modified_group.name:
        db_group.name = modified_group.name
    if modified_group.inbound_tags is not None:
        db_group.inbounds = await get_inbounds_by_tags(db, modified_group.inbound_tags)
    if modified_group.is_disabled is not None:
        db_group.is_disabled = modified_group.is_disabled
    await db.commit()
    await db.refresh(db_group)
    return db_group


async def remove_group(db: AsyncSession, dbgroup: Group):
    """
    Removes a group from the database.

    Args:
        db (AsyncSession): The database session.
        dbgroup (Group): The Group object to be removed.
    """
    await db.delete(dbgroup)
    await db.commit()

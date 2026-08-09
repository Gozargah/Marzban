"""
Functions for managing proxy hosts, users, user templates, nodes, and administrative tasks.
"""

from datetime import datetime, timedelta
from enum import Enum
from typing import Dict, List, Optional, Tuple, Union

from sqlalchemy import and_, delete, func, or_
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Query, Session, joinedload
from sqlalchemy.sql.functions import coalesce

from app.db.models import (
    JWT,
    TLS,
    Admin,
    AdminAuditLog,
    AdminUsageLogs,
    HostGroup,
    NextPlan,
    Node,
    NodeUsage,
    NodeUserUsage,
    NotificationReminder,
    Proxy,
    ProxyHost,
    ProxyInbound,
    ProxyTypes,
    System,
    User,
    UserDevice,
    UserGroupUsage,
    UserTemplate,
    UserUsageResetLogs,
    YukuSetting,
    host_group_hosts,
)
from app.models.admin import AdminCreate, AdminModify, AdminPartialModify
from app.models.host_group import HostGroupCreate, HostGroupModify
from app.models.node import NodeCreate, NodeModify, NodeStatus, NodeUsageResponse
from app.models.proxy import ProxyHost as ProxyHostModify
from app.models.user import (
    ReminderType,
    UserCreate,
    UserDataLimitResetStrategy,
    UserModify,
    UserResponse,
    UserStatus,
    UserUsageResponse,
)
from app.models.user_template import UserTemplateCreate, UserTemplateModify
from app.utils.helpers import calculate_expiration_days, calculate_usage_percent
from config import (
    DEVICE_TOUCH_DEBOUNCE_SECONDS,
    NOTIFY_DAYS_LEFT,
    NOTIFY_REACHED_USAGE_PERCENT,
    USERS_AUTODELETE_DAYS,
)


def add_default_host(db: Session, inbound: ProxyInbound):
    """
    Adds a default host to a proxy inbound.

    Args:
        db (Session): Database session.
        inbound (ProxyInbound): Proxy inbound to add the default host to.
    """
    host = ProxyHost(remark="🚀 Marz ({USERNAME}) [{PROTOCOL} - {TRANSPORT}]", address="{SERVER_IP}", inbound=inbound)
    db.add(host)
    db.commit()


def get_or_create_inbound(db: Session, inbound_tag: str) -> ProxyInbound:
    """
    Retrieves or creates a proxy inbound based on the given tag.

    Args:
        db (Session): Database session.
        inbound_tag (str): The tag of the inbound.

    Returns:
        ProxyInbound: The retrieved or newly created proxy inbound.
    """
    inbound = db.query(ProxyInbound).filter(ProxyInbound.tag == inbound_tag).first()
    if not inbound:
        inbound = ProxyInbound(tag=inbound_tag)
        db.add(inbound)
        db.commit()
        add_default_host(db, inbound)
        db.refresh(inbound)
    return inbound


def get_hosts(db: Session, inbound_tag: str) -> List[ProxyHost]:
    """
    Retrieves hosts for a given inbound tag.

    Args:
        db (Session): Database session.
        inbound_tag (str): The tag of the inbound.

    Returns:
        List[ProxyHost]: List of hosts for the inbound.
    """
    inbound = get_or_create_inbound(db, inbound_tag)
    return inbound.hosts


def add_host(db: Session, inbound_tag: str, host: ProxyHostModify) -> List[ProxyHost]:
    """
    Adds a new host to a proxy inbound.

    Args:
        db (Session): Database session.
        inbound_tag (str): The tag of the inbound.
        host (ProxyHostModify): Host details to be added.

    Returns:
        List[ProxyHost]: Updated list of hosts for the inbound.
    """
    inbound = get_or_create_inbound(db, inbound_tag)
    inbound.hosts.append(
        ProxyHost(
            remark=host.remark,
            address=host.address,
            port=host.port,
            path=host.path,
            sni=host.sni,
            host=host.host,
            inbound=inbound,
            security=host.security,
            alpn=host.alpn,
            fingerprint=host.fingerprint
        )
    )
    db.commit()
    db.refresh(inbound)
    return inbound.hosts


_HOST_EDITABLE_FIELDS = (
    "remark", "address", "port", "path", "sni", "host", "security", "alpn",
    "fingerprint", "allowinsecure", "is_disabled", "mux_enable",
    "fragment_setting", "noise_setting", "random_user_agent", "use_sni_as_host",
    "auto_select",
)

# fields that identify "the same host" well enough to re-pair it after an edit
_HOST_IDENTITY_FIELDS = ("remark", "address", "port", "path", "sni", "host")


def _host_identity(host) -> tuple:
    return tuple(getattr(host, f, None) for f in _HOST_IDENTITY_FIELDS)


def _host_column_value(field: str, value):
    """Value to write for a host column, applying the column default for a NULL
    on a NOT NULL column — an INSERT would do this for us, an UPDATE would not.
    """
    column = ProxyHost.__table__.columns.get(field)
    if value is not None or column is None or column.nullable:
        return value
    default = column.default
    if default is None:
        return value
    return default.arg(None) if callable(default.arg) else default.arg


def _pair_hosts(existing: List[ProxyHost], modified_hosts: list) -> dict:
    """Maps index in modified_hosts -> the existing row it should update.

    Exact-identity matches are taken first (so an untouched host always keeps
    its own row even if the list was reordered), then whatever is left is paired
    positionally — which is what a plain field edit on one host looks like.
    """
    pairs = {}
    unmatched = list(existing)

    for i, incoming in enumerate(modified_hosts):
        for row in unmatched:
            if _host_identity(row) == _host_identity(incoming):
                pairs[i] = row
                unmatched.remove(row)
                break

    leftovers = iter(unmatched)
    for i in range(len(modified_hosts)):
        if i in pairs:
            continue
        row = next(leftovers, None)
        if row is None:
            break
        pairs[i] = row

    return pairs


def update_hosts(db: Session, inbound_tag: str, modified_hosts: List[ProxyHostModify]) -> List[ProxyHost]:
    """
    Updates hosts for a given inbound tag.

    Rows are updated in place instead of being recreated. A host's id is
    referenced by host_group_hosts with ON DELETE CASCADE, so rebuilding the
    list (the previous behaviour) silently dropped every host out of its
    traffic group on each save of the hosts dialog.

    Args:
        db (Session): Database session.
        inbound_tag (str): The tag of the inbound.
        modified_hosts (List[ProxyHostModify]): List of modified hosts.

    Returns:
        List[ProxyHost]: Updated list of hosts for the inbound.
    """
    inbound = get_or_create_inbound(db, inbound_tag)
    existing = list(inbound.hosts)
    pairs = _pair_hosts(existing, modified_hosts)
    reused = {id(row) for row in pairs.values()}

    for i, incoming in enumerate(modified_hosts):
        row = pairs.get(i)
        if row is None:
            row = ProxyHost(inbound=inbound)
            db.add(row)
        for field in _HOST_EDITABLE_FIELDS:
            setattr(row, field, _host_column_value(field, getattr(incoming, field)))

    for row in existing:
        if id(row) not in reused:
            # SQLite runs with PRAGMA foreign_keys off, so ON DELETE CASCADE on
            # host_group_hosts never fires: drop the group links explicitly or
            # they dangle and can later re-attach to a host that reuses the id
            db.execute(
                host_group_hosts.delete().where(host_group_hosts.c.host_id == row.id)
            )
            db.delete(row)

    db.commit()
    db.refresh(inbound)
    return inbound.hosts


def get_user_queryset(db: Session) -> Query:
    """
    Retrieves the base user query with joined admin details.

    Args:
        db (Session): Database session.

    Returns:
        Query: Base user query.
    """
    return db.query(User).options(joinedload(User.admin)).options(joinedload(User.next_plan))


def get_user(db: Session, username: str) -> Optional[User]:
    """
    Retrieves a user by username.

    Args:
        db (Session): Database session.
        username (str): The username of the user.

    Returns:
        Optional[User]: The user object if found, else None.
    """
    return get_user_queryset(db).filter(User.username == username).first()


def get_user_by_id(db: Session, user_id: int) -> Optional[User]:
    """
    Retrieves a user by user ID.

    Args:
        db (Session): Database session.
        user_id (int): The ID of the user.

    Returns:
        Optional[User]: The user object if found, else None.
    """
    return get_user_queryset(db).filter(User.id == user_id).first()


UsersSortingOptions = Enum('UsersSortingOptions', {
    'username': User.username.asc(),
    'used_traffic': User.used_traffic.asc(),
    'data_limit': User.data_limit.asc(),
    'expire': User.expire.asc(),
    'created_at': User.created_at.asc(),
    'device_count': User.device_count.asc(),
    '-username': User.username.desc(),
    '-used_traffic': User.used_traffic.desc(),
    '-data_limit': User.data_limit.desc(),
    '-expire': User.expire.desc(),
    '-created_at': User.created_at.desc(),
    '-device_count': User.device_count.desc(),
})


def get_users(db: Session,
              offset: Optional[int] = None,
              limit: Optional[int] = None,
              usernames: Optional[List[str]] = None,
              search: Optional[str] = None,
              status: Optional[Union[UserStatus, list]] = None,
              sort: Optional[List[UsersSortingOptions]] = None,
              admin: Optional[Admin] = None,
              admins: Optional[List[str]] = None,
              reset_strategy: Optional[Union[UserDataLimitResetStrategy, list]] = None,
              return_with_count: bool = False) -> Union[List[User], Tuple[List[User], int]]:
    """
    Retrieves users based on various filters and options.

    Args:
        db (Session): Database session.
        offset (Optional[int]): Number of records to skip.
        limit (Optional[int]): Number of records to retrieve.
        usernames (Optional[List[str]]): List of usernames to filter by.
        search (Optional[str]): Search term to filter by username, note or device HWID/model.
        status (Optional[Union[UserStatus, list]]): User status or list of statuses to filter by.
        sort (Optional[List[UsersSortingOptions]]): Sorting options.
        admin (Optional[Admin]): Admin to filter users by.
        admins (Optional[List[str]]): List of admin usernames to filter users by.
        reset_strategy (Optional[Union[UserDataLimitResetStrategy, list]]): Data limit reset strategy to filter by.
        return_with_count (bool): Whether to return the total count of users.

    Returns:
        Union[List[User], Tuple[List[User], int]]: List of users or tuple of users and total count.
    """
    query = get_user_queryset(db)

    if search:
        # HWID/device-model matching uses .any() (EXISTS) rather than a join so
        # rows aren't multiplied — return_with_count below counts this query.
        query = query.filter(or_(
            User.username.ilike(f"%{search}%"),
            User.note.ilike(f"%{search}%"),
            User.devices.any(or_(
                UserDevice.hwid.ilike(f"%{search}%"),
                UserDevice.device_model.ilike(f"%{search}%"),
            )),
        ))

    if usernames:
        query = query.filter(User.username.in_(usernames))

    if status:
        if isinstance(status, list):
            query = query.filter(User.status.in_(status))
        else:
            query = query.filter(User.status == status)

    if reset_strategy:
        if isinstance(reset_strategy, list):
            query = query.filter(User.data_limit_reset_strategy.in_(reset_strategy))
        else:
            query = query.filter(User.data_limit_reset_strategy == reset_strategy)

    if admin:
        query = query.filter(User.admin == admin)

    if admins:
        query = query.filter(User.admin.has(Admin.username.in_(admins)))

    if return_with_count:
        count = query.count()

    if sort:
        query = query.order_by(*(opt.value for opt in sort))

    if offset:
        query = query.offset(offset)
    if limit:
        query = query.limit(limit)

    if return_with_count:
        return query.all(), count

    return query.all()


def get_user_usages(db: Session, dbuser: User, start: datetime, end: datetime) -> List[UserUsageResponse]:
    """
    Retrieves user usages within a specified date range.

    Args:
        db (Session): Database session.
        dbuser (User): The user object.
        start (datetime): Start date for usage retrieval.
        end (datetime): End date for usage retrieval.

    Returns:
        List[UserUsageResponse]: List of user usage responses.
    """

    usages = {0: UserUsageResponse(  # Main Core
        node_id=None,
        node_name="Master",
        used_traffic=0
    )}

    for node in db.query(Node).all():
        usages[node.id] = UserUsageResponse(
            node_id=node.id,
            node_name=node.name,
            used_traffic=0
        )

    cond = and_(NodeUserUsage.user_id == dbuser.id,
                NodeUserUsage.created_at >= start,
                NodeUserUsage.created_at <= end)

    for v in db.query(NodeUserUsage).filter(cond):
        try:
            usages[v.node_id or 0].used_traffic += v.used_traffic
        except KeyError:
            pass

    return list(usages.values())


def get_users_count(db: Session, status: UserStatus = None, admin: Admin = None) -> int:
    """
    Retrieves the count of users based on status and admin filters.

    Args:
        db (Session): Database session.
        status (UserStatus, optional): Status to filter users by.
        admin (Admin, optional): Admin to filter users by.

    Returns:
        int: Count of users matching the criteria.
    """
    query = db.query(User.id)
    if admin:
        query = query.filter(User.admin == admin)
    if status:
        query = query.filter(User.status == status)
    return query.count()


def create_user(db: Session, user: UserCreate, admin: Admin = None) -> User:
    """
    Creates a new user with provided details.

    Args:
        db (Session): Database session.
        user (UserCreate): User creation details.
        admin (Admin, optional): Admin associated with the user.

    Returns:
        User: The created user object.
    """
    excluded_inbounds_tags = user.excluded_inbounds
    proxies = []
    for proxy_type, settings in user.proxies.items():
        excluded_inbounds = [
            get_or_create_inbound(db, tag) for tag in excluded_inbounds_tags[proxy_type]
        ]
        proxies.append(
            Proxy(type=proxy_type.value,
                  settings=settings.dict(no_obj=True),
                  excluded_inbounds=excluded_inbounds)
        )

    dbuser = User(
        username=user.username,
        proxies=proxies,
        status=user.status,
        data_limit=(user.data_limit or None),
        device_limit=(
            user.device_limit if user.device_limit is not None
            else int(get_yuku_setting(db, "default_device_limit", "0") or 0)
        ),
        expire=(user.expire or None),
        admin=admin,
        data_limit_reset_strategy=user.data_limit_reset_strategy,
        note=user.note,
        on_hold_expire_duration=(user.on_hold_expire_duration or None),
        on_hold_timeout=(user.on_hold_timeout or None),
        auto_delete_in_days=user.auto_delete_in_days,
        next_plan=NextPlan(
            data_limit=user.next_plan.data_limit,
            expire=user.next_plan.expire,
            add_remaining_traffic=user.next_plan.add_remaining_traffic,
            fire_on_either=user.next_plan.fire_on_either,
        ) if user.next_plan else None
    )
    db.add(dbuser)
    db.commit()
    db.refresh(dbuser)
    return dbuser


def remove_user(db: Session, dbuser: User) -> User:
    """
    Removes a user from the database.

    Args:
        db (Session): Database session.
        dbuser (User): The user object to be removed.

    Returns:
        User: The removed user object.
    """
    db.delete(dbuser)
    db.commit()
    return dbuser


def remove_users(db: Session, dbusers: List[User]):
    """
    Removes multiple users from the database.

    Args:
        db (Session): Database session.
        dbusers (List[User]): List of user objects to be removed.
    """
    for dbuser in dbusers:
        db.delete(dbuser)
    db.commit()
    return


def update_user(db: Session, dbuser: User, modify: UserModify) -> User:
    """
    Updates a user with new details.

    Args:
        db (Session): Database session.
        dbuser (User): The user object to be updated.
        modify (UserModify): New details for the user.

    Returns:
        User: The updated user object.
    """
    added_proxies: Dict[ProxyTypes, Proxy] = {}
    if modify.proxies:
        for proxy_type, settings in modify.proxies.items():
            dbproxy = db.query(Proxy) \
                .where(Proxy.user == dbuser, Proxy.type == proxy_type) \
                .first()
            if dbproxy:
                dbproxy.settings = settings.dict(no_obj=True)
            else:
                new_proxy = Proxy(type=proxy_type, settings=settings.dict(no_obj=True))
                dbuser.proxies.append(new_proxy)
                added_proxies.update({proxy_type: new_proxy})
        for proxy in dbuser.proxies:
            if proxy.type not in modify.proxies:
                db.delete(proxy)
    if modify.inbounds:
        for proxy_type, tags in modify.excluded_inbounds.items():
            dbproxy = db.query(Proxy) \
                .where(Proxy.user == dbuser, Proxy.type == proxy_type) \
                .first() or added_proxies.get(proxy_type)
            if dbproxy:
                dbproxy.excluded_inbounds = [get_or_create_inbound(db, tag) for tag in tags]

    if modify.status is not None:
        dbuser.status = modify.status

    if modify.data_limit is not None:
        dbuser.data_limit = (modify.data_limit or None)
        if dbuser.status not in (UserStatus.expired, UserStatus.disabled):
            if not dbuser.data_limit or dbuser.used_traffic < dbuser.data_limit:
                if dbuser.status != UserStatus.on_hold:
                    dbuser.status = UserStatus.active

                for percent in sorted(NOTIFY_REACHED_USAGE_PERCENT, reverse=True):
                    if not dbuser.data_limit or (calculate_usage_percent(
                            dbuser.used_traffic, dbuser.data_limit) < percent):
                        reminder = get_notification_reminder(db, dbuser.id, ReminderType.data_usage, threshold=percent)
                        if reminder:
                            delete_notification_reminder(db, reminder)

            else:
                dbuser.status = UserStatus.limited

    if modify.expire is not None:
        dbuser.expire = (modify.expire or None)
        if dbuser.status in (UserStatus.active, UserStatus.expired):
            if not dbuser.expire or dbuser.expire > datetime.utcnow().timestamp():
                dbuser.status = UserStatus.active
                for days_left in sorted(NOTIFY_DAYS_LEFT):
                    if not dbuser.expire or (calculate_expiration_days(
                            dbuser.expire) > days_left):
                        reminder = get_notification_reminder(
                            db, dbuser.id, ReminderType.expiration_date, threshold=days_left)
                        if reminder:
                            delete_notification_reminder(db, reminder)
            else:
                dbuser.status = UserStatus.expired

    if modify.note is not None:
        dbuser.note = modify.note or None

    if modify.data_limit_reset_strategy is not None:
        dbuser.data_limit_reset_strategy = modify.data_limit_reset_strategy.value

    if modify.device_limit is not None:
        dbuser.device_limit = (modify.device_limit or 0)

    if modify.on_hold_timeout is not None:
        dbuser.on_hold_timeout = modify.on_hold_timeout

    if modify.on_hold_expire_duration is not None:
        dbuser.on_hold_expire_duration = modify.on_hold_expire_duration

    if modify.next_plan is not None:
        dbuser.next_plan = NextPlan(
            data_limit=modify.next_plan.data_limit,
            expire=modify.next_plan.expire,
            add_remaining_traffic=modify.next_plan.add_remaining_traffic,
            fire_on_either=modify.next_plan.fire_on_either,
        )
    elif dbuser.next_plan is not None:
        db.delete(dbuser.next_plan)

    dbuser.edit_at = datetime.utcnow()

    db.commit()
    db.refresh(dbuser)
    return dbuser


def get_user_devices(db: Session, user_id: int) -> List[UserDevice]:
    """Returns all registered HWID devices of a user."""
    return db.query(UserDevice).filter(UserDevice.user_id == user_id) \
        .order_by(UserDevice.last_seen.desc()).all()


def get_device_stats(db: Session) -> dict:
    """Aggregate device metrics for the dashboard."""
    not_revoked = or_(UserDevice.status.is_(None), UserDevice.status != "revoked")

    total = db.query(func.count(UserDevice.id)).scalar() or 0
    active = db.query(func.count(UserDevice.id)).filter(not_revoked).scalar() or 0

    by_platform = (
        db.query(func.coalesce(UserDevice.platform, "unknown"), func.count(UserDevice.id))
        .filter(not_revoked)
        .group_by(UserDevice.platform)
        .all()
    )

    users_with_limit = db.query(func.count(User.id)).filter(
        User.device_limit.isnot(None), User.device_limit > 0
    ).scalar() or 0

    # users whose active device count exceeds their limit
    counts = (
        db.query(UserDevice.user_id.label("uid"), func.count(UserDevice.id).label("cnt"))
        .filter(not_revoked)
        .group_by(UserDevice.user_id)
        .subquery()
    )
    users_over_limit = db.query(func.count(User.id)).join(
        counts, counts.c.uid == User.id
    ).filter(
        User.device_limit.isnot(None),
        User.device_limit > 0,
        counts.c.cnt > User.device_limit,
    ).scalar() or 0

    return {
        "total_devices": total,
        "active_devices": active,
        "revoked_devices": max(total - active, 0),
        "users_with_limit": users_with_limit,
        "users_over_limit": users_over_limit,
        "by_platform": [
            {"platform": p or "unknown", "count": c}
            for p, c in sorted(by_platform, key=lambda x: -x[1])
        ],
    }


# Pseudo-HWID used to track clients that don't send an x-hwid header
# (e.g. v2rayNG). They are fingerprinted by user-agent instead, so a single
# UA-less device still occupies one slot rather than bypassing the limit.
UNKNOWN_HWID = "unknown-device"


def count_user_devices(db: Session, user_id: int) -> int:
    """Number of devices that count toward the limit (revoked excluded)."""
    return db.query(UserDevice).filter(
        UserDevice.user_id == user_id,
        or_(UserDevice.status.is_(None), UserDevice.status != "revoked"),
    ).count()


def get_user_device(db: Session, user_id: int, hwid: str) -> Optional[UserDevice]:
    """Returns a specific device by user_id + hwid, or None (any status)."""
    return db.query(UserDevice).filter(
        UserDevice.user_id == user_id, UserDevice.hwid == hwid
    ).first()


def create_user_device(db: Session, user_id: int, hwid: str,
                       platform: str = None, os_version: str = None,
                       device_model: str = None, user_agent: str = None) -> UserDevice:
    """Registers a new HWID device for a user."""
    now = datetime.utcnow()
    device = UserDevice(
        user_id=user_id, hwid=hwid, platform=platform, os_version=os_version,
        device_model=device_model, user_agent=user_agent, status="active",
        created_at=now, last_seen=now,
    )
    db.add(device)
    db.commit()
    db.refresh(device)
    return device


def _touch_device_metadata(device: UserDevice, platform: str = None,
                           os_version: str = None, device_model: str = None,
                           user_agent: str = None) -> None:
    """Refreshes last_seen + metadata in-place (caller commits)."""
    device.last_seen = datetime.utcnow()
    if platform:
        device.platform = platform
    if os_version:
        device.os_version = os_version
    if device_model:
        device.device_model = device_model
    if user_agent:
        device.user_agent = user_agent


def touch_user_device(db: Session, device: UserDevice, platform: str = None,
                      os_version: str = None, device_model: str = None,
                      user_agent: str = None) -> UserDevice:
    """Updates last_seen (and metadata if provided) of an existing device."""
    _touch_device_metadata(device, platform, os_version, device_model, user_agent)
    db.commit()
    db.refresh(device)
    return device


def _unknown_user_agents_match(stored: Optional[str], incoming: Optional[str]) -> bool:
    """Two UA-less requests are the 'same device' only if their UAs match."""
    def norm(v: Optional[str]) -> Optional[str]:
        if v is None:
            return None
        s = v.strip()
        return s or None
    return norm(stored) == norm(incoming)


def register_user_device(db: Session, dbuser, hwid: Optional[str],
                         platform: str = None, os_version: str = None,
                         device_model: str = None,
                         user_agent: str = None) -> tuple[bool, bool]:
    """Register/refresh the requesting device and apply the device limit.

    Returns ``(registered, unsupported)``:
      * ``(True, False)``  – device is known/created and is allowed.
      * ``(False, False)`` – a genuine new device beyond the limit (block it).
      * ``(False, True)``  – an untrackable UA-less client (let it through).
    """
    limit = dbuser.device_limit or 0

    # --- clients without x-hwid: track one pseudo-device per matching UA ---
    if not hwid:
        device = get_user_device(db, dbuser.id, UNKNOWN_HWID)
        if device:
            if _unknown_user_agents_match(device.user_agent, user_agent):
                reactivated = device.status == "revoked"
                if reactivated:
                    device.status = "active"
                _touch_device_if_stale(db, device, platform, os_version,
                                       device_model, user_agent, force=reactivated)
                return True, False
            # a different UA-less client — can't fingerprint it, leave untracked
            return False, True
        if limit and count_user_devices(db, dbuser.id) >= limit:
            return False, False
        return _insert_device(db, dbuser.id, UNKNOWN_HWID, platform,
                              os_version, device_model, user_agent), False

    # --- normal HWID clients ---
    device = get_user_device(db, dbuser.id, hwid)
    if device:
        if device.status == "revoked":
            # re-activating a revoked device must respect the limit
            if limit and count_user_devices(db, dbuser.id) >= limit:
                _touch_device_if_stale(db, device, platform, os_version,
                                       device_model, user_agent)  # stay revoked
                return False, False
            device.status = "active"
            _touch_device_if_stale(db, device, platform, os_version,
                                   device_model, user_agent, force=True)
            return True, False
        _touch_device_if_stale(db, device, platform, os_version,
                               device_model, user_agent)
        return True, False

    if limit and count_user_devices(db, dbuser.id) >= limit:
        return False, False

    return _insert_device(db, dbuser.id, hwid, platform,
                          os_version, device_model, user_agent), False


def _touch_device_if_stale(db: Session, device: UserDevice, platform: str = None,
                           os_version: str = None, device_model: str = None,
                           user_agent: str = None, force: bool = False) -> None:
    """Refresh last_seen/metadata, but skip the write entirely if the device was
    seen recently and nothing new was learned. Keeps the /sub hot path read-only
    on repeat refreshes (debounced by DEVICE_TOUCH_DEBOUNCE_SECONDS)."""
    now = datetime.utcnow()
    stale = (
        device.last_seen is None
        or (now - device.last_seen) >= timedelta(seconds=DEVICE_TOUCH_DEBOUNCE_SECONDS)
    )
    new_meta = (
        (platform and platform != device.platform)
        or (os_version and os_version != device.os_version)
        or (device_model and device_model != device.device_model)
        or (user_agent and user_agent != device.user_agent)
    )
    if not (force or stale or new_meta):
        return  # fast path: no DB write on this refresh
    _touch_device_metadata(device, platform, os_version, device_model, user_agent)
    db.commit()


def _insert_device(db: Session, user_id: int, hwid: str, platform: str = None,
                   os_version: str = None, device_model: str = None,
                   user_agent: str = None) -> bool:
    """Insert a new active device, tolerating concurrent duplicate inserts."""
    now = datetime.utcnow()
    device = UserDevice(
        user_id=user_id, hwid=hwid, platform=platform, os_version=os_version,
        device_model=device_model, user_agent=user_agent, status="active",
        created_at=now, last_seen=now,
    )
    db.add(device)
    try:
        db.commit()
    except IntegrityError:
        # a concurrent subscription request already created this (user_id, hwid)
        db.rollback()
        return True
    return True


def revoke_user_device(db: Session, device: UserDevice) -> UserDevice:
    """Soft-bans a device (keeps the row, frees its slot)."""
    device.status = "revoked"
    device.last_seen = datetime.utcnow()
    db.commit()
    db.refresh(device)
    return device


def remove_user_device(db: Session, device: UserDevice) -> None:
    """Hard-deletes a registered device."""
    db.delete(device)
    db.commit()


def get_user_device_by_id(db: Session, user_id: int, device_id: int) -> Optional[UserDevice]:
    """Returns a device by its id, scoped to a user."""
    return db.query(UserDevice).filter(
        UserDevice.id == device_id, UserDevice.user_id == user_id
    ).first()


def get_yuku_settings(db: Session) -> dict:
    """Returns all YUKU settings as a {key: value} dict."""
    return {s.key: s.value for s in db.query(YukuSetting).all()}


def get_yuku_setting(db: Session, key: str, default: str = None) -> Optional[str]:
    """Returns a single setting value, or default if missing."""
    row = db.query(YukuSetting).filter(YukuSetting.key == key).first()
    return row.value if row is not None else default


def set_yuku_settings(db: Session, values: dict) -> dict:
    """Upserts multiple settings; returns the full settings dict afterwards."""
    for key, value in values.items():
        key = str(key)
        row = db.query(YukuSetting).filter(YukuSetting.key == key).first()
        if row is None:
            db.add(YukuSetting(key=key, value=(None if value is None else str(value))))
        else:
            row.value = (None if value is None else str(value))
    db.commit()
    return get_yuku_settings(db)


def reset_user_data_usage(db: Session, dbuser: User) -> User:
    """
    Resets the data usage of a user and logs the reset.

    Args:
        db (Session): Database session.
        dbuser (User): The user object whose data usage is to be reset.

    Returns:
        User: The updated user object.
    """
    usage_log = UserUsageResetLogs(
        user=dbuser,
        used_traffic_at_reset=dbuser.used_traffic,
    )
    db.add(usage_log)

    dbuser.used_traffic = 0
    dbuser.node_usages.clear()
    if dbuser.status not in (UserStatus.expired or UserStatus.disabled):
        dbuser.status = UserStatus.active.value

    if dbuser.next_plan:
        db.delete(dbuser.next_plan)
        dbuser.next_plan = None
    db.add(dbuser)

    db.commit()
    db.refresh(dbuser)
    return dbuser


def reset_user_by_next(db: Session, dbuser: User) -> User:
    """
    Resets the data usage of a user based on next user.

    Args:
        db (Session): Database session.
        dbuser (User): The user object whose data usage is to be reset.

    Returns:
        User: The updated user object.
    """

    if (dbuser.next_plan is None):
        return

    usage_log = UserUsageResetLogs(
        user=dbuser,
        used_traffic_at_reset=dbuser.used_traffic,
    )
    db.add(usage_log)

    dbuser.node_usages.clear()
    dbuser.status = UserStatus.active.value

    dbuser.data_limit = dbuser.next_plan.data_limit + \
        (0 if dbuser.next_plan.add_remaining_traffic else dbuser.data_limit - dbuser.used_traffic)
    dbuser.expire = dbuser.next_plan.expire

    dbuser.used_traffic = 0
    db.delete(dbuser.next_plan)
    dbuser.next_plan = None
    db.add(dbuser)

    db.commit()
    db.refresh(dbuser)
    return dbuser


def revoke_user_sub(db: Session, dbuser: User) -> User:
    """
    Revokes the subscription of a user and updates proxies settings.

    Args:
        db (Session): Database session.
        dbuser (User): The user object whose subscription is to be revoked.

    Returns:
        User: The updated user object.
    """
    dbuser.sub_revoked_at = datetime.utcnow()

    user = UserResponse.model_validate(dbuser)
    for proxy_type, settings in user.proxies.copy().items():
        settings.revoke()
        user.proxies[proxy_type] = settings
    dbuser = update_user(db, dbuser, user)

    db.commit()
    db.refresh(dbuser)
    return dbuser


def update_user_sub(db: Session, dbuser: User, user_agent: str) -> User:
    """
    Updates the user's subscription details.

    Args:
        db (Session): Database session.
        dbuser (User): The user object whose subscription is to be updated.
        user_agent (str): The user agent string to update.

    Returns:
        User: The updated user object.
    """
    dbuser.sub_updated_at = datetime.utcnow()
    dbuser.sub_last_user_agent = user_agent

    db.commit()
    db.refresh(dbuser)
    return dbuser


def reset_all_users_data_usage(db: Session, admin: Optional[Admin] = None):
    """
    Resets the data usage for all users or users under a specific admin.

    Args:
        db (Session): Database session.
        admin (Optional[Admin]): Admin to filter users by, if any.
    """
    query = get_user_queryset(db)

    if admin:
        query = query.filter(User.admin == admin)

    for dbuser in query.all():
        dbuser.used_traffic = 0
        if dbuser.status not in [UserStatus.on_hold, UserStatus.expired, UserStatus.disabled]:
            dbuser.status = UserStatus.active
        dbuser.usage_logs.clear()
        dbuser.node_usages.clear()
        if dbuser.next_plan:
            db.delete(dbuser.next_plan)
            dbuser.next_plan = None
        db.add(dbuser)

    db.commit()


def disable_all_active_users(db: Session, admin: Optional[Admin] = None):
    """
    Disable all active users or users under a specific admin.

    Args:
        db (Session): Database session.
        admin (Optional[Admin]): Admin to filter users by, if any.
    """
    query = db.query(User).filter(User.status.in_((UserStatus.active, UserStatus.on_hold)))
    if admin:
        query = query.filter(User.admin == admin)

    query.update({User.status: UserStatus.disabled, User.last_status_change: datetime.utcnow()}, synchronize_session=False)

    db.commit()


def activate_all_disabled_users(db: Session, admin: Optional[Admin] = None):
    """
    Activate all disabled users or users under a specific admin.

    Args:
        db (Session): Database session.
        admin (Optional[Admin]): Admin to filter users by, if any.
    """
    query_for_active_users = db.query(User).filter(User.status == UserStatus.disabled)
    query_for_on_hold_users = db.query(User).filter(
        and_(
            User.status == UserStatus.disabled, User.expire.is_(
                None), User.on_hold_expire_duration.isnot(None), User.online_at.is_(None)
        ))
    if admin:
        query_for_active_users = query_for_active_users.filter(User.admin == admin)
        query_for_on_hold_users = query_for_on_hold_users.filter(User.admin == admin)

    query_for_on_hold_users.update(
        {User.status: UserStatus.on_hold, User.last_status_change: datetime.utcnow()}, synchronize_session=False)
    query_for_active_users.update(
        {User.status: UserStatus.active, User.last_status_change: datetime.utcnow()}, synchronize_session=False)

    db.commit()


def autodelete_expired_users(db: Session,
                             include_limited_users: bool = False) -> List[User]:
    """
    Deletes expired (optionally also limited) users whose auto-delete time has passed.

    Args:
        db (Session): Database session
        include_limited_users (bool, optional): Whether to delete limited users as well.
            Defaults to False.

    Returns:
        list[User]: List of deleted users.
    """
    target_status = (
        [UserStatus.expired] if not include_limited_users
        else [UserStatus.expired, UserStatus.limited]
    )

    auto_delete = coalesce(User.auto_delete_in_days, USERS_AUTODELETE_DAYS)

    query = db.query(
        User, auto_delete,  # Use global auto-delete days as fallback
    ).filter(
        auto_delete >= 0,  # Negative values prevent auto-deletion
        User.status.in_(target_status),
    ).options(joinedload(User.admin))

    # TODO: Handle time filter in query itself (NOTE: Be careful with sqlite's strange datetime handling)
    expired_users = [
        user
        for (user, auto_delete) in query
        if user.last_status_change + timedelta(days=auto_delete) <= datetime.utcnow()
    ]

    if expired_users:
        remove_users(db, expired_users)

    return expired_users


def get_all_users_usages(
        db: Session, admin: Admin, start: datetime, end: datetime
) -> List[UserUsageResponse]:
    """
    Retrieves usage data for all users associated with an admin within a specified time range.

    This function calculates the total traffic used by users across different nodes,
    including a "Master" node that represents the main core.

    Args:
        db (Session): Database session for querying.
        admin (Admin): The admin user for which to retrieve user usage data.
        start (datetime): The start date and time of the period to consider.
        end (datetime): The end date and time of the period to consider.

    Returns:
        List[UserUsageResponse]: A list of UserUsageResponse objects, each representing
        the usage data for a specific node or the main core.
    """
    usages = {0: UserUsageResponse(  # Main Core
        node_id=None,
        node_name="Master",
        used_traffic=0
    )}

    for node in db.query(Node).all():
        usages[node.id] = UserUsageResponse(
            node_id=node.id,
            node_name=node.name,
            used_traffic=0
        )

    admin_users = set(user.id for user in get_users(db=db, admins=admin))

    cond = and_(
        NodeUserUsage.created_at >= start,
        NodeUserUsage.created_at <= end,
        NodeUserUsage.user_id.in_(admin_users)
    )

    for v in db.query(NodeUserUsage).filter(cond):
        try:
            usages[v.node_id or 0].used_traffic += v.used_traffic
        except KeyError:
            pass

    return list(usages.values())


def update_user_status(db: Session, dbuser: User, status: UserStatus) -> User:
    """
    Updates a user's status and records the time of change.

    Args:
        db (Session): Database session.
        dbuser (User): The user to update.
        status (UserStatus): The new status.

    Returns:
        User: The updated user object.
    """
    dbuser.status = status
    dbuser.last_status_change = datetime.utcnow()
    db.commit()
    db.refresh(dbuser)
    return dbuser


def set_owner(db: Session, dbuser: User, admin: Admin) -> User:
    """
    Sets the owner (admin) of a user.

    Args:
        db (Session): Database session.
        dbuser (User): The user object whose owner is to be set.
        admin (Admin): The admin to set as owner.

    Returns:
        User: The updated user object.
    """
    dbuser.admin = admin
    db.commit()
    db.refresh(dbuser)
    return dbuser


def start_user_expire(db: Session, dbuser: User) -> User:
    """
    Starts the expiration timer for a user.

    Args:
        db (Session): Database session.
        dbuser (User): The user object whose expiration timer is to be started.

    Returns:
        User: The updated user object.
    """
    expire = int(datetime.utcnow().timestamp()) + dbuser.on_hold_expire_duration
    dbuser.expire = expire
    dbuser.on_hold_expire_duration = None
    dbuser.on_hold_timeout = None
    db.commit()
    db.refresh(dbuser)
    return dbuser


def get_system_usage(db: Session) -> System:
    """
    Retrieves system usage information.

    Args:
        db (Session): Database session.

    Returns:
        System: System usage information.
    """
    return db.query(System).first()


def get_jwt_secret_key(db: Session) -> str:
    """
    Retrieves the JWT secret key.

    Args:
        db (Session): Database session.

    Returns:
        str: JWT secret key.
    """
    return db.query(JWT).first().secret_key


def get_tls_certificate(db: Session) -> TLS:
    """
    Retrieves the TLS certificate.

    Args:
        db (Session): Database session.

    Returns:
        TLS: TLS certificate information.
    """
    return db.query(TLS).first()


def get_admin(db: Session, username: str) -> Admin:
    """
    Retrieves an admin by username.

    Args:
        db (Session): Database session.
        username (str): The username of the admin.

    Returns:
        Admin: The admin object.
    """
    return db.query(Admin).filter(Admin.username == username).first()


def create_admin(db: Session, admin: AdminCreate) -> Admin:
    """
    Creates a new admin in the database.

    Args:
        db (Session): Database session.
        admin (AdminCreate): The admin creation data.

    Returns:
        Admin: The created admin object.
    """
    dbadmin = Admin(
        username=admin.username,
        hashed_password=admin.hashed_password,
        is_sudo=admin.is_sudo,
        telegram_id=admin.telegram_id if admin.telegram_id else None,
        discord_webhook=admin.discord_webhook if admin.discord_webhook else None
    )
    db.add(dbadmin)
    db.commit()
    db.refresh(dbadmin)
    return dbadmin


def update_admin(db: Session, dbadmin: Admin, modified_admin: AdminModify) -> Admin:
    """
    Updates an admin's details.

    Args:
        db (Session): Database session.
        dbadmin (Admin): The admin object to be updated.
        modified_admin (AdminModify): The modified admin data.

    Returns:
        Admin: The updated admin object.
    """
    if modified_admin.is_sudo:
        dbadmin.is_sudo = modified_admin.is_sudo
    if modified_admin.password is not None and dbadmin.hashed_password != modified_admin.hashed_password:
        dbadmin.hashed_password = modified_admin.hashed_password
        dbadmin.password_reset_at = datetime.utcnow()
    if modified_admin.telegram_id:
        dbadmin.telegram_id = modified_admin.telegram_id
    if modified_admin.discord_webhook:
        dbadmin.discord_webhook = modified_admin.discord_webhook

    db.commit()
    db.refresh(dbadmin)
    return dbadmin


def partial_update_admin(db: Session, dbadmin: Admin, modified_admin: AdminPartialModify) -> Admin:
    """
    Partially updates an admin's details.

    Args:
        db (Session): Database session.
        dbadmin (Admin): The admin object to be updated.
        modified_admin (AdminPartialModify): The modified admin data.

    Returns:
        Admin: The updated admin object.
    """
    if modified_admin.is_sudo is not None:
        dbadmin.is_sudo = modified_admin.is_sudo
    if modified_admin.password is not None and dbadmin.hashed_password != modified_admin.hashed_password:
        dbadmin.hashed_password = modified_admin.hashed_password
        dbadmin.password_reset_at = datetime.utcnow()
    if modified_admin.telegram_id is not None:
        dbadmin.telegram_id = modified_admin.telegram_id
    if modified_admin.discord_webhook is not None:
        dbadmin.discord_webhook = modified_admin.discord_webhook

    db.commit()
    db.refresh(dbadmin)
    return dbadmin


def remove_admin(db: Session, dbadmin: Admin) -> Admin:
    """
    Removes an admin from the database.

    Args:
        db (Session): Database session.
        dbadmin (Admin): The admin object to be removed.

    Returns:
        Admin: The removed admin object.
    """
    db.delete(dbadmin)
    db.commit()
    return dbadmin


def get_admin_by_id(db: Session, id: int) -> Admin:
    """
    Retrieves an admin by their ID.

    Args:
        db (Session): Database session.
        id (int): The ID of the admin.

    Returns:
        Admin: The admin object.
    """
    return db.query(Admin).filter(Admin.id == id).first()


def get_admin_by_telegram_id(db: Session, telegram_id: int) -> Admin:
    """
    Retrieves an admin by their Telegram ID.

    Args:
        db (Session): Database session.
        telegram_id (int): The Telegram ID of the admin.

    Returns:
        Admin: The admin object.
    """
    return db.query(Admin).filter(Admin.telegram_id == telegram_id).first()


def get_admins(db: Session,
               offset: Optional[int] = None,
               limit: Optional[int] = None,
               username: Optional[str] = None) -> List[Admin]:
    """
    Retrieves a list of admins with optional filters and pagination.

    Args:
        db (Session): Database session.
        offset (Optional[int]): The number of records to skip (for pagination).
        limit (Optional[int]): The maximum number of records to return.
        username (Optional[str]): The username to filter by.

    Returns:
        List[Admin]: A list of admin objects.
    """
    query = db.query(Admin)
    if username:
        query = query.filter(Admin.username.ilike(f'%{username}%'))
    if offset:
        query = query.offset(offset)
    if limit:
        query = query.limit(limit)
    return query.all()


def reset_admin_usage(db: Session, dbadmin: Admin) -> int:
    """
    Retrieves an admin's usage by their username.
    Args:
        db (Session): Database session.
        dbadmin (Admin): The admin object to be updated.
    Returns:
        Admin: The updated admin.
    """
    if (dbadmin.users_usage == 0):
        return dbadmin

    usage_log = AdminUsageLogs(
        admin=dbadmin,
        used_traffic_at_reset=dbadmin.users_usage
    )
    db.add(usage_log)
    dbadmin.users_usage = 0

    db.commit()
    db.refresh(dbadmin)
    return dbadmin


def create_user_template(db: Session, user_template: UserTemplateCreate) -> UserTemplate:
    """
    Creates a new user template in the database.

    Args:
        db (Session): Database session.
        user_template (UserTemplateCreate): The user template creation data.

    Returns:
        UserTemplate: The created user template object.
    """
    inbound_tags: List[str] = []
    for _, i in user_template.inbounds.items():
        inbound_tags.extend(i)
    dbuser_template = UserTemplate(
        name=user_template.name,
        data_limit=user_template.data_limit,
        expire_duration=user_template.expire_duration,
        username_prefix=user_template.username_prefix,
        username_suffix=user_template.username_suffix,
        inbounds=db.query(ProxyInbound).filter(ProxyInbound.tag.in_(inbound_tags)).all()
    )
    db.add(dbuser_template)
    db.commit()
    db.refresh(dbuser_template)
    return dbuser_template


def update_user_template(
        db: Session, dbuser_template: UserTemplate, modified_user_template: UserTemplateModify) -> UserTemplate:
    """
    Updates a user template's details.

    Args:
        db (Session): Database session.
        dbuser_template (UserTemplate): The user template object to be updated.
        modified_user_template (UserTemplateModify): The modified user template data.

    Returns:
        UserTemplate: The updated user template object.
    """
    if modified_user_template.name is not None:
        dbuser_template.name = modified_user_template.name
    if modified_user_template.data_limit is not None:
        dbuser_template.data_limit = modified_user_template.data_limit
    if modified_user_template.expire_duration is not None:
        dbuser_template.expire_duration = modified_user_template.expire_duration
    if modified_user_template.username_prefix is not None:
        dbuser_template.username_prefix = modified_user_template.username_prefix
    if modified_user_template.username_suffix is not None:
        dbuser_template.username_suffix = modified_user_template.username_suffix

    if modified_user_template.inbounds:
        inbound_tags: List[str] = []
        for _, i in modified_user_template.inbounds.items():
            inbound_tags.extend(i)
        dbuser_template.inbounds = db.query(ProxyInbound).filter(ProxyInbound.tag.in_(inbound_tags)).all()

    db.commit()
    db.refresh(dbuser_template)
    return dbuser_template


def remove_user_template(db: Session, dbuser_template: UserTemplate):
    """
    Removes a user template from the database.

    Args:
        db (Session): Database session.
        dbuser_template (UserTemplate): The user template object to be removed.
    """
    db.delete(dbuser_template)
    db.commit()


def get_user_template(db: Session, user_template_id: int) -> UserTemplate:
    """
    Retrieves a user template by its ID.

    Args:
        db (Session): Database session.
        user_template_id (int): The ID of the user template.

    Returns:
        UserTemplate: The user template object.
    """
    return db.query(UserTemplate).filter(UserTemplate.id == user_template_id).first()


def get_user_templates(
        db: Session, offset: Union[int, None] = None, limit: Union[int, None] = None) -> List[UserTemplate]:
    """
    Retrieves a list of user templates with optional pagination.

    Args:
        db (Session): Database session.
        offset (Union[int, None]): The number of records to skip (for pagination).
        limit (Union[int, None]): The maximum number of records to return.

    Returns:
        List[UserTemplate]: A list of user template objects.
    """
    dbuser_templates = db.query(UserTemplate)
    if offset:
        dbuser_templates = dbuser_templates.offset(offset)
    if limit:
        dbuser_templates = dbuser_templates.limit(limit)

    return dbuser_templates.all()


def get_node(db: Session, name: str) -> Optional[Node]:
    """
    Retrieves a node by its name.

    Args:
        db (Session): The database session.
        name (str): The name of the node to retrieve.

    Returns:
        Optional[Node]: The Node object if found, None otherwise.
    """
    return db.query(Node).filter(Node.name == name).first()


def get_node_by_id(db: Session, node_id: int) -> Optional[Node]:
    """
    Retrieves a node by its ID.

    Args:
        db (Session): The database session.
        node_id (int): The ID of the node to retrieve.

    Returns:
        Optional[Node]: The Node object if found, None otherwise.
    """
    return db.query(Node).filter(Node.id == node_id).first()


def get_nodes(db: Session,
              status: Optional[Union[NodeStatus, list]] = None,
              enabled: bool = None) -> List[Node]:
    """
    Retrieves nodes based on optional status and enabled filters.

    Args:
        db (Session): The database session.
        status (Optional[Union[NodeStatus, list]]): The status or list of statuses to filter by.
        enabled (bool): If True, excludes disabled nodes.

    Returns:
        List[Node]: A list of Node objects matching the criteria.
    """
    query = db.query(Node)

    if status:
        if isinstance(status, list):
            query = query.filter(Node.status.in_(status))
        else:
            query = query.filter(Node.status == status)

    if enabled:
        query = query.filter(Node.status != NodeStatus.disabled)

    return query.all()


def get_nodes_usage(db: Session, start: datetime, end: datetime) -> List[NodeUsageResponse]:
    """
    Retrieves usage data for all nodes within a specified time range.

    Args:
        db (Session): The database session.
        start (datetime): The start time of the usage period.
        end (datetime): The end time of the usage period.

    Returns:
        List[NodeUsageResponse]: A list of NodeUsageResponse objects containing usage data.
    """
    usages = {0: NodeUsageResponse(  # Main Core
        node_id=None,
        node_name="Master",
        uplink=0,
        downlink=0
    )}

    for node in db.query(Node).all():
        usages[node.id] = NodeUsageResponse(
            node_id=node.id,
            node_name=node.name,
            uplink=0,
            downlink=0
        )

    cond = and_(NodeUsage.created_at >= start, NodeUsage.created_at <= end)

    for v in db.query(NodeUsage).filter(cond):
        try:
            usages[v.node_id or 0].uplink += v.uplink
            usages[v.node_id or 0].downlink += v.downlink
        except KeyError:
            pass

    return list(usages.values())


def create_node(db: Session, node: NodeCreate) -> Node:
    """
    Creates a new node in the database.

    Args:
        db (Session): The database session.
        node (NodeCreate): The node creation model containing node details.

    Returns:
        Node: The newly created Node object.
    """
    dbnode = Node(name=node.name,
                  address=node.address,
                  port=node.port,
                  api_port=node.api_port)

    db.add(dbnode)
    db.commit()
    db.refresh(dbnode)
    return dbnode


def remove_node(db: Session, dbnode: Node) -> Node:
    """
    Removes a node from the database.

    Args:
        db (Session): The database session.
        dbnode (Node): The Node object to be removed.

    Returns:
        Node: The removed Node object.
    """
    db.delete(dbnode)
    db.commit()
    return dbnode


def update_node(db: Session, dbnode: Node, modify: NodeModify) -> Node:
    """
    Updates an existing node with new information.

    Args:
        db (Session): The database session.
        dbnode (Node): The Node object to be updated.
        modify (NodeModify): The modification model containing updated node details.

    Returns:
        Node: The updated Node object.
    """
    if modify.name is not None:
        dbnode.name = modify.name

    if modify.address is not None:
        dbnode.address = modify.address

    if modify.port is not None:
        dbnode.port = modify.port

    if modify.api_port is not None:
        dbnode.api_port = modify.api_port

    if modify.status is NodeStatus.disabled:
        dbnode.status = modify.status
        dbnode.xray_version = None
        dbnode.message = None
    else:
        dbnode.status = NodeStatus.connecting

    if modify.usage_coefficient:
        dbnode.usage_coefficient = modify.usage_coefficient

    db.commit()
    db.refresh(dbnode)
    return dbnode


def update_node_status(db: Session, dbnode: Node, status: NodeStatus, message: str = None, version: str = None) -> Node:
    """
    Updates the status of a node.

    Args:
        db (Session): The database session.
        dbnode (Node): The Node object to be updated.
        status (NodeStatus): The new status of the node.
        message (str, optional): A message associated with the status update.
        version (str, optional): The version of the node software.

    Returns:
        Node: The updated Node object.
    """
    dbnode.status = status
    dbnode.message = message
    dbnode.xray_version = version
    dbnode.last_status_change = datetime.utcnow()
    db.commit()
    db.refresh(dbnode)
    return dbnode


def create_notification_reminder(
        db: Session, reminder_type: ReminderType, expires_at: datetime, user_id: int, threshold: Optional[int] = None) -> NotificationReminder:
    """
    Creates a new notification reminder.

    Args:
        db (Session): The database session.
        reminder_type (ReminderType): The type of reminder.
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
    db.commit()
    db.refresh(reminder)
    return reminder


def get_notification_reminder(
        db: Session, user_id: int, reminder_type: ReminderType, threshold: Optional[int] = None
) -> Union[NotificationReminder, None]:
    """
    Retrieves a notification reminder for a user.

    Args:
        db (Session): The database session.
        user_id (int): The ID of the user.
        reminder_type (ReminderType): The type of reminder to retrieve.
        threshold (Optional[int]): The threshold value to check for (e.g., days left or usage percent).

    Returns:
        Union[NotificationReminder, None]: The NotificationReminder object if found and not expired, None otherwise.
    """
    query = db.query(NotificationReminder).filter(
        NotificationReminder.user_id == user_id,
        NotificationReminder.type == reminder_type
    )

    # If a threshold is provided, filter for reminders with this threshold
    if threshold is not None:
        query = query.filter(NotificationReminder.threshold == threshold)

    reminder = query.first()

    if reminder is None:
        return None

    # Check if the reminder has expired
    if reminder.expires_at and reminder.expires_at < datetime.utcnow():
        db.delete(reminder)
        db.commit()
        return None

    return reminder


def delete_notification_reminder_by_type(
        db: Session, user_id: int, reminder_type: ReminderType, threshold: Optional[int] = None
) -> None:
    """
    Deletes a notification reminder for a user based on the reminder type and optional threshold.

    Args:
        db (Session): The database session.
        user_id (int): The ID of the user.
        reminder_type (ReminderType): The type of reminder to delete.
        threshold (Optional[int]): The threshold to delete (e.g., days left or usage percent). If not provided, deletes all reminders of that type.
    """
    stmt = delete(NotificationReminder).where(
        NotificationReminder.user_id == user_id,
        NotificationReminder.type == reminder_type
    )

    # If a threshold is provided, include it in the filter
    if threshold is not None:
        stmt = stmt.where(NotificationReminder.threshold == threshold)

    db.execute(stmt)
    db.commit()


def delete_notification_reminder(db: Session, dbreminder: NotificationReminder) -> None:
    """
    Deletes a specific notification reminder.

    Args:
        db (Session): The database session.
        dbreminder (NotificationReminder): The NotificationReminder object to delete.
    """
    db.delete(dbreminder)
    db.commit()
    return


def count_online_users(db: Session, hours: int = 24):
    twenty_four_hours_ago = datetime.utcnow() - timedelta(hours=hours)
    query = db.query(func.count(User.id)).filter(User.online_at.isnot(
        None), User.online_at >= twenty_four_hours_ago)
    return query.scalar()


# --- YUKU host traffic groups -------------------------------------------------

def get_host_groups(db: Session) -> List[HostGroup]:
    return db.query(HostGroup).order_by(HostGroup.name).all()


def get_host_group(db: Session, group_id: int) -> Optional[HostGroup]:
    return db.query(HostGroup).filter(HostGroup.id == group_id).first()


def get_host_group_by_name(db: Session, name: str) -> Optional[HostGroup]:
    return db.query(HostGroup).filter(HostGroup.name == name).first()


def _apply_group_members(db: Session, group: HostGroup,
                         host_ids: Optional[List[int]],
                         node_ids: Optional[List[int]]) -> None:
    if host_ids is not None:
        group.hosts = (
            db.query(ProxyHost).filter(ProxyHost.id.in_(host_ids)).all()
            if host_ids else []
        )
    if node_ids is not None:
        group.nodes = (
            db.query(Node).filter(Node.id.in_(node_ids)).all()
            if node_ids else []
        )


def create_host_group(db: Session, group: HostGroupCreate) -> HostGroup:
    dbgroup = HostGroup(
        name=group.name,
        traffic_limit=group.traffic_limit or None,
        reset_strategy=group.reset_strategy or "no_reset",
        notice_text=group.notice_text,
        include_master=bool(group.include_master),
    )
    db.add(dbgroup)
    db.flush()
    _apply_group_members(db, dbgroup, group.host_ids, group.node_ids)
    db.commit()
    db.refresh(dbgroup)
    return dbgroup


def update_host_group(db: Session, dbgroup: HostGroup,
                      modify: HostGroupModify) -> HostGroup:
    if modify.name is not None:
        dbgroup.name = modify.name
    if modify.traffic_limit is not None:
        dbgroup.traffic_limit = modify.traffic_limit or None
    if modify.reset_strategy is not None:
        dbgroup.reset_strategy = modify.reset_strategy
    if modify.notice_text is not None:
        dbgroup.notice_text = modify.notice_text
    if modify.include_master is not None:
        dbgroup.include_master = bool(modify.include_master)
    _apply_group_members(db, dbgroup, modify.host_ids, modify.node_ids)
    db.commit()
    db.refresh(dbgroup)
    return dbgroup


def remove_host_group(db: Session, dbgroup: HostGroup) -> None:
    db.delete(dbgroup)
    db.commit()


def get_node_group_map(db: Session) -> dict:
    """node_id -> group_id, for attributing node usage to a group. Empty when no
    groups exist (the accounting step then becomes a no-op). The master xray is
    keyed by None for groups that opt in via include_master."""
    rows = db.query(HostGroup.id, Node.id).join(HostGroup.nodes).all()
    m = {node_id: group_id for group_id, node_id in rows}
    for g in db.query(HostGroup.id).filter(HostGroup.include_master.is_(True)).all():
        m[None] = g.id  # only one group should include master (router-enforced)
    return m


def get_user_group_usage(db: Session, user_id: int,
                         group_id: int) -> Optional[UserGroupUsage]:
    return db.query(UserGroupUsage).filter(
        UserGroupUsage.user_id == user_id,
        UserGroupUsage.group_id == group_id,
    ).first()


def get_user_group_usages(db: Session, user_id: int) -> List[UserGroupUsage]:
    return db.query(UserGroupUsage).filter(
        UserGroupUsage.user_id == user_id
    ).all()


def reset_user_group_usage(db: Session, user_id: int, group_id: int) -> None:
    row = get_user_group_usage(db, user_id, group_id)
    if row:
        row.used_traffic = 0
        row.reset_at = datetime.utcnow()
        db.commit()


def set_user_group(db: Session, user_id: int, group_id: int,
                   member: Optional[bool] = None,
                   traffic_limit: Optional[int] = None,
                   set_limit: bool = False) -> UserGroupUsage:
    """Set a user's group membership and/or per-group limit override. Creates the
    usage row if needed. ``set_limit`` distinguishes "clear the override" (None)
    from "don't touch it"."""
    row = get_user_group_usage(db, user_id, group_id)
    if not row:
        row = UserGroupUsage(user_id=user_id, group_id=group_id, used_traffic=0)
        db.add(row)
    if member is not None:
        row.member = bool(member)
    if set_limit:
        row.traffic_limit = traffic_limit if traffic_limit else None
    db.commit()
    db.refresh(row)
    return row


# --- YUKU admin audit log ---------------------------------------------------

def create_audit_log(db: Session,
                     action: str,
                     admin_username: Optional[str] = None,
                     admin_id: Optional[int] = None,
                     target_type: Optional[str] = None,
                     target_name: Optional[str] = None,
                     method: Optional[str] = None,
                     path: Optional[str] = None,
                     status_code: Optional[int] = None,
                     ip: Optional[str] = None,
                     user_agent: Optional[str] = None,
                     details: Optional[dict] = None) -> AdminAuditLog:
    """Appends one row to the admin action history."""
    row = AdminAuditLog(
        action=action,
        admin_username=admin_username,
        admin_id=admin_id,
        target_type=target_type,
        target_name=(str(target_name)[:128] if target_name is not None else None),
        method=method,
        path=path,
        status_code=status_code,
        ip=ip,
        user_agent=user_agent,
        details=details,
    )
    db.add(row)
    db.commit()
    db.refresh(row)
    return row


def get_audit_logs(db: Session,
                   offset: Optional[int] = None,
                   limit: Optional[int] = None,
                   admin_username: Optional[str] = None,
                   action: Optional[str] = None,
                   target_type: Optional[str] = None,
                   search: Optional[str] = None,
                   date_from: Optional[datetime] = None,
                   date_to: Optional[datetime] = None) -> Tuple[List[AdminAuditLog], int]:
    """Audit rows newest-first plus the total matching the same filters.

    ``search`` matches the target name, the IP and the request path, so one box
    covers "what happened to user X" and "what came from that IP".
    """
    query = db.query(AdminAuditLog)

    if admin_username:
        query = query.filter(AdminAuditLog.admin_username == admin_username)
    if action:
        query = query.filter(AdminAuditLog.action == action)
    if target_type:
        query = query.filter(AdminAuditLog.target_type == target_type)
    if search:
        query = query.filter(or_(
            AdminAuditLog.target_name.ilike(f"%{search}%"),
            AdminAuditLog.ip.ilike(f"%{search}%"),
            AdminAuditLog.path.ilike(f"%{search}%"),
        ))
    if date_from:
        query = query.filter(AdminAuditLog.created_at >= date_from)
    if date_to:
        query = query.filter(AdminAuditLog.created_at <= date_to)

    count = query.count()
    query = query.order_by(AdminAuditLog.created_at.desc(), AdminAuditLog.id.desc())

    if offset:
        query = query.offset(offset)
    if limit:
        query = query.limit(limit)

    return query.all(), count


def get_audit_log_admins(db: Session) -> List[str]:
    """Distinct admin usernames present in the history (for the UI filter)."""
    rows = db.query(AdminAuditLog.admin_username).distinct().all()
    return sorted({r[0] for r in rows if r[0]})


def purge_audit_logs(db: Session, older_than: datetime) -> int:
    """Deletes audit rows older than ``older_than``; returns the row count."""
    deleted = db.query(AdminAuditLog).filter(
        AdminAuditLog.created_at < older_than
    ).delete(synchronize_session=False)
    db.commit()
    return deleted

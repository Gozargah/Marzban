"""
Functions for managing proxy hosts, users, user templates, nodes, and administrative tasks.
"""

from datetime import datetime, timedelta
from enum import Enum
from typing import Any, cast

from sqlalchemy import and_, delete, func, or_, select, update
from sqlalchemy.dialects.mysql import insert as mysql_insert
from sqlalchemy.dialects.sqlite import insert as sqlite_insert
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Query, Session, joinedload
from sqlalchemy.sql.functions import coalesce

from app.db.models import (
    JWT,
    TLS,
    Admin,
    AdminUsageLogs,
    Bot,
    BotSettings,
    CascadeRoute,
    GlobalSetting,
    HostCompositionSnapshot,
    ManagedSetting,
    NextPlan,
    Node,
    NodeUsage,
    NodeUserBlock,
    NodeUserBsUsage,
    NodeUserUsage,
    NodeWeightSnapshot,
    NotificationReminder,
    Proxy,
    ProxyHost,
    ProxyInbound,
    ProxyTypes,
    System,
    User,
    UserDevice,
    UserNodePin,
    UserTemplate,
    UserUsageResetLogs,
    host_bot_association,
    master_inbounds_association,
)
from app.models.admin import AdminCreate, AdminModify, AdminPartialModify
from app.models.bot import apply_bot_settings_fallback
from app.models.node import NodeCreate, NodeModify, NodeRole, NodeStatus, NodeUsageResponse
from app.models.proxy import ProxyHost as ProxyHostModify
from app.models.user import (
    ReminderType,
    UserCreate,
    UserDataLimitResetStrategy,
    UserDeviceCreate,
    UserDeviceUpdate,
    UserModify,
    UserResponse,
    UserStatus,
    UserUsageResponse,
)
from app.models.user_template import UserTemplateCreate, UserTemplateModify
from app.subscription.device_ua import unknown_user_agents_match as _unknown_user_agents_match
from app.utils.helpers import calculate_expiration_days, calculate_usage_percent
from app.utils.jwt import create_subscription_token
from app.xray.address_policy import WEIGHT_SNAPSHOT_MAX_AGE_DAYS
from app.xray.cascade_keys import generate_cascade_identity
from config import (
    HOSTING_USAGE_CUTOFF_PERCENT,
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


def get_hosts(db: Session, inbound_tag: str) -> list[ProxyHost]:
    """
    Retrieves hosts for a given inbound tag.

    Args:
        db (Session): Database session.
        inbound_tag (str): The tag of the inbound.

    Returns:
        List[ProxyHost]: List of hosts for the inbound.
    """
    inbound = get_or_create_inbound(db, inbound_tag)
    return sorted(inbound.hosts, key=lambda host: (host.order, host.id))


def _max_host_order(db: Session, exclude_inbound_tag: str | None = None) -> int:
    """Max hosts.order across the table (optionally excluding one inbound)."""
    query = db.query(func.max(ProxyHost.order))
    if exclude_inbound_tag is not None:
        query = query.filter(ProxyHost.inbound_tag != exclude_inbound_tag)
    value = query.scalar()
    return int(value) if value is not None else -1


def _resolve_host_orders(db: Session, inbound_tag: str, modified_hosts: list[ProxyHostModify]) -> list[int]:
    """Fill missing order values by appending after the current global max."""
    next_order = _max_host_order(db, exclude_inbound_tag=inbound_tag)
    resolved: list[int] = []
    for host in modified_hosts:
        if host.order is None:
            next_order += 1
            resolved.append(next_order)
        else:
            resolved.append(int(host.order))
            next_order = max(next_order, int(host.order))
    return resolved


def _apply_rental_marks(db: Session, host: ProxyHost, rented_bot_usernames: list[str]) -> None:
    """Проставляет и снимает host_bot_association.rented_at (NPVPN-2044).

    Дата НЕ переставляется у уже отмеченных: «арендует с такого числа» не должно
    превращаться в «арендует с сегодня» при каждом сохранении формы.

    Работает через Core по (host_id, bot_id), а не через relationship: аренда —
    атрибут строки association, а переназначение коллекции host.bots удалило бы
    и вставило эти строки заново, потеряв отметку.
    """
    wanted = {name for name in (_normalize_bot_username(n) for n in rented_bot_usernames or []) if name}
    bound = {bot.username: bot.id for bot in host.bots}

    unknown = wanted - set(bound)
    if unknown:
        raise ValueError(f"rented bot is not bound to host: {sorted(unknown)}")

    db.flush()  # у нового хоста id появляется только после flush
    wanted_ids = {bound[name] for name in wanted}
    for bot_id in bound.values():
        condition = and_(
            host_bot_association.c.host_id == host.id,
            host_bot_association.c.bot_id == bot_id,
        )
        if bot_id in wanted_ids:
            db.execute(
                host_bot_association.update()
                .where(condition, host_bot_association.c.rented_at.is_(None))
                .values(rented_at=datetime.utcnow())
            )
        else:
            db.execute(host_bot_association.update().where(condition).values(rented_at=None))


def _get_bots_by_usernames(db: Session, bot_usernames: list[str]) -> list[Bot]:
    normalized_usernames = []
    for username in bot_usernames or []:
        normalized = _normalize_bot_username(username)
        if normalized and normalized not in normalized_usernames:
            normalized_usernames.append(normalized)

    if not normalized_usernames:
        return []

    bots = db.query(Bot).filter(Bot.username.in_(normalized_usernames)).all()
    bots_by_username = {bot.username: bot for bot in bots}
    missing_usernames = [username for username in normalized_usernames if username not in bots_by_username]
    if missing_usernames:
        raise ValueError(f'Bot "{missing_usernames[0]}" not found')

    return [bots_by_username[username] for username in normalized_usernames]


def _get_nodes_by_ids(db: Session, node_ids: list[int]) -> list[Node]:
    unique_ids = []
    for node_id in node_ids or []:
        if node_id not in unique_ids:
            unique_ids.append(node_id)

    if not unique_ids:
        return []

    nodes = db.query(Node).filter(Node.id.in_(unique_ids)).all()
    nodes_by_id = {int(node.id): node for node in nodes}
    missing = [node_id for node_id in unique_ids if node_id not in nodes_by_id]
    if missing:
        raise ValueError(f"Node {missing[0]} not found")

    return [nodes_by_id[node_id] for node_id in unique_ids]


def add_host(db: Session, inbound_tag: str, host: ProxyHostModify) -> list[ProxyHost]:
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
    bots = _get_bots_by_usernames(db, host.bot_usernames)
    nodes = _get_nodes_by_ids(db, host.node_ids)
    order = host.order if host.order is not None else _max_host_order(db) + 1
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
            fingerprint=host.fingerprint,
            xhttp_extra=host.xhttp_extra,
            order=order,
            client_config_id=host.client_config_id,
            # NPVPN-2072: сужение адресов настраивается на хосте.
            address_subset_enabled=host.address_subset_enabled,
            address_subset_size=host.address_subset_size,
            address_rotation_days=host.address_rotation_days,
            bots=bots,
            nodes=nodes,
        )
    )
    db.commit()
    db.refresh(inbound)
    return get_hosts(db, inbound_tag)


def update_hosts(db: Session, inbound_tag: str, modified_hosts: list[ProxyHostModify]) -> list[ProxyHost]:
    """Обновляет хосты инбаунда, сохраняя identity существующих строк.

    NPVPN-2044: раньше здесь было `inbound.hosts = [ProxyHost(...) ...]`, то есть
    полное пересоздание на каждое сохранение формы. hosts.id менялся, а на него
    ссылаются user_node_pins с ondelete=CASCADE — закрепления пользователей
    молча исчезали, — и HostCompositionSnapshot.host_id пришлось оставить без FK.
    Отметка аренды на host_bot_association умирала бы так же, поэтому сохранение
    переведено на upsert по id.

    Args:
        db (Session): Database session.
        inbound_tag (str): The tag of the inbound.
        modified_hosts (List[ProxyHostModify]): List of modified hosts.

    Returns:
        List[ProxyHost]: Updated list of hosts for the inbound.
    """
    inbound = get_or_create_inbound(db, inbound_tag)
    orders = _resolve_host_orders(db, inbound_tag, modified_hosts)

    incoming_ids = [host.id for host in modified_hosts if host.id is not None]
    if len(incoming_ids) != len(set(incoming_ids)):
        raise ValueError("duplicate host id in payload")

    existing = {host.id: host for host in inbound.hosts}
    unknown = set(incoming_ids) - set(existing)
    if unknown:
        raise ValueError(f"host id does not belong to inbound {inbound_tag}: {sorted(unknown)}")

    incoming_id_set = set(incoming_ids)
    for host, order in zip(modified_hosts, orders):
        target = existing[host.id] if host.id is not None else ProxyHost(inbound=inbound)
        target.remark = host.remark
        target.address = host.address
        target.port = host.port
        target.path = host.path
        target.sni = host.sni
        target.host = host.host
        target.security = host.security
        target.alpn = host.alpn
        target.fingerprint = host.fingerprint
        target.allowinsecure = host.allowinsecure
        target.is_disabled = host.is_disabled
        target.fragment_setting = host.fragment_setting
        target.noise_setting = host.noise_setting
        # Эти три колонки NOT NULL с server_default, а в схеме они `bool | None`.
        # None значит «клиент не передал поле», а не «сбросить»: присваивание
        # None падало бы IntegrityError. False проходит и выключает флаг.
        for _not_null_flag in ("mux_enable", "random_user_agent", "use_sni_as_host"):
            _value = getattr(host, _not_null_flag)
            if _value is not None:
                setattr(target, _not_null_flag, _value)
        target.xhttp_extra = host.xhttp_extra
        target.order = order
        target.client_config_id = host.client_config_id
        target.address_subset_enabled = host.address_subset_enabled
        target.address_subset_size = host.address_subset_size
        target.address_rotation_days = host.address_rotation_days
        target.bots = _get_bots_by_usernames(db, host.bot_usernames)
        _apply_rental_marks(db, target, host.rented_bot_usernames)
        target.nodes = _get_nodes_by_ids(db, host.node_ids)
        if host.id is None:
            db.add(target)

    for host_id, host in existing.items():
        if host_id not in incoming_id_set:
            db.delete(host)

    db.commit()
    db.refresh(inbound)
    return get_hosts(db, inbound_tag)


def get_user_queryset(db: Session) -> Query:
    """
    Retrieves the base user query with joined admin details.

    Args:
        db (Session): Database session.

    Returns:
        Query: Base user query.
    """
    return (
        db.query(User)
        .options(joinedload(User.admin))
        .options(joinedload(User.next_plan))
        .options(joinedload(User.bot).joinedload(Bot.settings))
        .options(joinedload(User.node_bs_usages))
    )


def get_user(db: Session, username: str) -> User | None:
    """
    Retrieves a user by username.

    Args:
        db (Session): Database session.
        username (str): The username of the user.

    Returns:
        Optional[User]: The user object if found, else None.
    """
    return get_user_queryset(db).filter(User.username == username).first()


def get_user_by_id(db: Session, user_id: int) -> User | None:
    """
    Retrieves a user by user ID.

    Args:
        db (Session): Database session.
        user_id (int): The ID of the user.

    Returns:
        Optional[User]: The user object if found, else None.
    """
    return get_user_queryset(db).filter(User.id == user_id).first()


def _normalize_bot_username(bot_username: str | None) -> str | None:
    if bot_username is None:
        return None
    bot_username = bot_username.strip()
    if bot_username == "":
        return ""
    return bot_username.lstrip("@")


def get_bot(db: Session, bot_username: str) -> Bot | None:
    normalized = _normalize_bot_username(bot_username)
    if not normalized:
        return None
    return db.query(Bot).filter(Bot.username == normalized).first()


def get_bot_by_source_id(db: Session, source_bot_id: int) -> Bot | None:
    return db.query(Bot).filter(Bot.source_bot_id == source_bot_id).first()


def get_bots(db: Session) -> list[Bot]:
    return db.query(Bot).order_by(Bot.username.asc()).all()


def _normalize_web_url(value: str | None) -> str:
    domain = str(value or "").strip().replace("https://", "").replace("http://", "").strip("/")
    if not domain:
        return ""
    return f"https://{domain}"


def _set_bot_web_url(db: Session, bot: Bot, web_url: str | None) -> None:
    if web_url is None:
        return
    settings = get_or_create_bot_settings(db, bot)
    data = apply_bot_settings_fallback(settings.data)
    data["web_url"] = _normalize_web_url(web_url)
    settings.data = data
    settings.updated_at = datetime.utcnow()
    db.commit()


def create_bot(
    db: Session,
    username: str,
    title: str | None = None,
    web_url: str | None = None,
    *,
    source_bot_id: int | None = None,
    admin_sync_enabled: bool = True,
) -> Bot:
    normalized = _normalize_bot_username(username)
    if not normalized:
        raise ValueError("Bot username is required")
    if get_bot(db, normalized):
        raise ValueError(f'Bot "{normalized}" already exists')

    bot = Bot(
        username=normalized,
        title=title or None,
        source_bot_id=source_bot_id,
        admin_sync_enabled=admin_sync_enabled,
    )
    db.add(bot)
    db.commit()
    db.refresh(bot)
    _set_bot_web_url(db, bot, web_url)
    db.refresh(bot)
    return bot


def update_bot(db: Session, bot: Bot, username: str, title: str | None = None, web_url: str | None = None) -> Bot:
    normalized = _normalize_bot_username(username)
    if not normalized:
        raise ValueError("Bot username is required")

    conflict = db.query(Bot).filter(Bot.username == normalized, Bot.id != bot.id).first()
    if conflict:
        raise ValueError(f'Bot "{normalized}" already exists')

    bot.username = normalized
    bot.title = title.strip() if isinstance(title, str) and title.strip() else None
    db.commit()
    db.refresh(bot)
    _set_bot_web_url(db, bot, web_url)
    db.refresh(bot)
    return bot


def delete_bot(db: Session, bot: Bot) -> None:
    users = db.query(User).filter(User.bot_id == bot.id).all()
    for user in users:
        user.bot_id = None
    db.delete(bot)
    db.commit()


def get_or_create_bot_settings(db: Session, bot: Bot) -> BotSettings:
    settings = db.query(BotSettings).filter(BotSettings.bot_id == bot.id).first()
    if settings:
        return settings

    settings = BotSettings(bot_id=bot.id, data={})
    db.add(settings)
    db.commit()
    db.refresh(settings)
    return settings


def get_bot_settings(db: Session, bot: Bot) -> dict[str, Any]:
    return dict(get_or_create_bot_settings(db, bot).data or {})


def update_bot_settings(db: Session, bot: Bot, settings_data: dict[str, Any]) -> dict[str, Any]:
    settings = get_or_create_bot_settings(db, bot)
    settings.data = settings_data
    settings.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(settings)
    return dict(settings.data or {})


def set_bot_admin_sync_enabled(db: Session, bot: Bot, enabled: bool) -> Bot:
    cast(Any, bot).admin_sync_enabled = enabled
    db.commit()
    db.refresh(bot)
    return bot


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


# Невидимые символы, которые прилипают к строке при копировании из Telegram и
# мессенджеров: внутри ILIKE '%...%' любой из них ломает совпадение (NPVPN-2161).
_SEARCH_INVISIBLE_CHARS = dict.fromkeys(map(ord, "\u200b\u200c\u200d\u2060\ufeff"))
_SEARCH_SPACE_CHARS = dict.fromkeys(map(ord, "\u00a0\u2007\u202f"), " ")


def normalize_users_search(search: str | None) -> str | None:
    """Строка поиска пользователей без невидимых символов и пробелов по краям; None — если пусто."""
    if search is None:
        return None
    search = search.translate(_SEARCH_INVISIBLE_CHARS).translate(_SEARCH_SPACE_CHARS).strip()
    return search or None


def get_users(
    db: Session,
    offset: int | None = None,
    limit: int | None = None,
    usernames: list[str] | None = None,
    search: str | None = None,
    bot_username: str | None = None,
    status: UserStatus | list | None = None,
    sort: list[UsersSortingOptions] | None = None,
    admin: Admin | None = None,
    admins: list[str] | None = None,
    reset_strategy: UserDataLimitResetStrategy | list | None = None,
    return_with_count: bool = False,
) -> list[User] | tuple[list[User], int]:
    """
    Retrieves users based on various filters and options.

    Args:
        db (Session): Database session.
        offset (Optional[int]): Number of records to skip.
        limit (Optional[int]): Number of records to retrieve.
        usernames (Optional[List[str]]): List of usernames to filter by.
        search (Optional[str]): Search term to filter by username or note.
        bot_username (Optional[str]): Bot username to filter users by.
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

    search = normalize_users_search(search)
    if search:
        query = query.filter(or_(User.username.ilike(f"%{search}%"), User.note.ilike(f"%{search}%")))

    if usernames:
        query = query.filter(User.username.in_(usernames))

    if bot_username:
        normalized = _normalize_bot_username(bot_username)
        if normalized:
            query = query.join(User.bot).filter(Bot.username == normalized)

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


def get_user_usages(db: Session, dbuser: User, start: datetime, end: datetime) -> list[UserUsageResponse]:
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

    usages = {
        0: UserUsageResponse(  # Main Core
            node_id=None, node_name="Master", used_traffic=0
        )
    }

    for node in db.query(Node).all():
        usages[node.id] = UserUsageResponse(node_id=node.id, node_name=node.name, used_traffic=0)

    cond = and_(NodeUserUsage.user_id == dbuser.id, NodeUserUsage.created_at >= start, NodeUserUsage.created_at <= end)

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
        excluded_inbounds = [get_or_create_inbound(db, tag) for tag in excluded_inbounds_tags[proxy_type]]
        proxies.append(
            Proxy(type=proxy_type.value, settings=settings.dict(no_obj=True), excluded_inbounds=excluded_inbounds)
        )

    bot = get_bot(db, user.bot_username) if user.bot_username else None
    if user.bot_username and not bot:
        raise ValueError(f'Bot "{user.bot_username}" not found')

    dbuser = User(
        username=user.username,
        proxies=proxies,
        status=user.status,
        data_limit=(user.data_limit or None),
        device_limit=(user.device_limit or None),
        expire=(user.expire or None),
        admin=admin,
        data_limit_reset_strategy=user.data_limit_reset_strategy,
        note=user.note,
        bot=bot,
        on_hold_expire_duration=(user.on_hold_expire_duration or None),
        on_hold_timeout=(user.on_hold_timeout or None),
        auto_delete_in_days=user.auto_delete_in_days,
        next_plan=NextPlan(
            data_limit=user.next_plan.data_limit,
            expire=user.next_plan.expire,
            add_remaining_traffic=user.next_plan.add_remaining_traffic,
            fire_on_either=user.next_plan.fire_on_either,
        )
        if user.next_plan
        else None,
    )
    # Ensure stable subscription token exists from day one
    dbuser.subscription_token = create_subscription_token(user.username)
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


def remove_users(db: Session, dbusers: list[User]):
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
    if modify.bs_extra is not None and modify.bs_limit_total is not None:
        raise ValueError("Нельзя задать bs_extra и bs_limit_total одновременно")

    added_proxies: dict[ProxyTypes, Proxy] = {}
    if modify.proxies:
        for proxy_type, settings in modify.proxies.items():
            dbproxy = db.query(Proxy).where(Proxy.user == dbuser, Proxy.type == proxy_type).first()
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
            dbproxy = db.query(Proxy).where(
                Proxy.user == dbuser, Proxy.type == proxy_type
            ).first() or added_proxies.get(proxy_type)
            if dbproxy:
                dbproxy.excluded_inbounds = [get_or_create_inbound(db, tag) for tag in tags]

    if modify.status is not None:
        dbuser.status = modify.status

    if modify.data_limit is not None:
        dbuser.data_limit = modify.data_limit or None
        if dbuser.status not in (UserStatus.expired, UserStatus.disabled):
            if not dbuser.data_limit or dbuser.used_traffic < dbuser.data_limit:
                if dbuser.status != UserStatus.on_hold:
                    dbuser.status = UserStatus.active

                for percent in sorted(NOTIFY_REACHED_USAGE_PERCENT, reverse=True):
                    if not dbuser.data_limit or (
                        calculate_usage_percent(dbuser.used_traffic, dbuser.data_limit) < percent
                    ):
                        reminder = get_notification_reminder(db, dbuser.id, ReminderType.data_usage, threshold=percent)
                        if reminder:
                            delete_notification_reminder(db, reminder)

            else:
                dbuser.status = UserStatus.limited

    if modify.device_limit is not None:
        dbuser.device_limit = modify.device_limit or None

    if modify.expire is not None:
        dbuser.expire = modify.expire or None
        if dbuser.status in (UserStatus.active, UserStatus.expired):
            if not dbuser.expire or dbuser.expire > datetime.utcnow().timestamp():
                dbuser.status = UserStatus.active
                for days_left in sorted(NOTIFY_DAYS_LEFT):
                    if not dbuser.expire or (calculate_expiration_days(dbuser.expire) > days_left):
                        reminder = get_notification_reminder(
                            db, dbuser.id, ReminderType.expiration_date, threshold=days_left
                        )
                        if reminder:
                            delete_notification_reminder(db, reminder)
            else:
                dbuser.status = UserStatus.expired

    if modify.note is not None:
        dbuser.note = modify.note or None

    if modify.bot_username is not None:
        normalized = _normalize_bot_username(modify.bot_username)
        if normalized == "":
            dbuser.bot = None
        else:
            bot = get_bot(db, normalized)
            if not bot:
                raise ValueError(f'Bot "{modify.bot_username}" not found')
            dbuser.bot = bot

    if modify.data_limit_reset_strategy is not None:
        dbuser.data_limit_reset_strategy = modify.data_limit_reset_strategy.value

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

    if modify.bs_extra is not None:
        set_user_bs_extra_amount(db, dbuser, modify.bs_extra)
    elif modify.bs_limit_total is not None:
        set_user_bs_limit_total(db, dbuser, modify.bs_limit_total)

    dbuser.edit_at = datetime.utcnow()

    db.commit()
    db.refresh(dbuser)
    return dbuser


def get_user_devices(db: Session, dbuser: User) -> list[UserDevice]:
    return db.query(UserDevice).filter(UserDevice.user_id == dbuser.id).order_by(UserDevice.last_seen.desc()).all()


UNKNOWN_DEVICE_HWID = "Неизвестное устройство"


def get_user_active_devices(db: Session, dbuser: User) -> list[UserDevice]:
    return (
        db.query(UserDevice)
        .filter(
            UserDevice.user_id == dbuser.id,
            UserDevice.status == "active",
        )
        .order_by(UserDevice.last_seen.desc())
        .all()
    )


def get_user_active_devices_by_first_seen(db: Session, dbuser: User) -> list[UserDevice]:
    return (
        db.query(UserDevice)
        .filter(
            UserDevice.user_id == dbuser.id,
            UserDevice.status == "active",
        )
        .order_by(UserDevice.first_seen.asc(), UserDevice.id.asc())
        .all()
    )


def is_device_within_limit(db: Session, dbuser: User, dbdevice: UserDevice | None) -> bool:
    """True if the device is among the first N active by first_seen (then id)."""
    limit = dbuser.device_limit
    if not limit:
        return True
    if dbdevice is None:
        return False
    for index, device in enumerate(get_user_active_devices_by_first_seen(db, dbuser)):
        if device.id == dbdevice.id:
            return index < int(limit)
    return False


def _hard_mode_blocks_new_device(db: Session, dbuser: User, *, hard_mode: bool) -> bool:
    if not hard_mode:
        return False
    limit = dbuser.device_limit
    if not limit:
        return False
    return count_user_devices(db, dbuser) >= int(limit)


def get_user_device(db: Session, dbuser: User, device_id: int) -> UserDevice | None:
    return db.query(UserDevice).filter(UserDevice.user_id == dbuser.id, UserDevice.id == device_id).first()


def get_user_device_by_hwid(db: Session, dbuser: User, hwid: str) -> UserDevice | None:
    return db.query(UserDevice).filter(UserDevice.user_id == dbuser.id, UserDevice.hwid == hwid).first()


def count_user_devices(db: Session, dbuser: User) -> int:
    return (
        db.query(func.count(UserDevice.id))
        .filter(
            UserDevice.user_id == dbuser.id,
            or_(UserDevice.status.is_(None), UserDevice.status != "revoked"),
        )
        .scalar()
        or 0
    )


def is_device_limit_reached(db: Session, dbuser: User) -> bool:
    """True when active devices are at or over the limit (e.g. 10/10, 11/10)."""
    limit = dbuser.device_limit
    if not limit:
        return False
    return count_user_devices(db, dbuser) >= int(limit)


def is_device_limit_exceeded(db: Session, dbuser: User) -> bool:
    """True when active devices strictly exceed the limit (e.g. 11/10, not 10/10)."""
    limit = dbuser.device_limit
    if not limit:
        return False
    return count_user_devices(db, dbuser) > int(limit)


def create_user_device(db: Session, dbuser: User, device: UserDeviceCreate) -> UserDevice:
    dbdevice = UserDevice(
        user_id=dbuser.id,
        hwid=device.hwid,
        device_os=device.device_os,
        ver_os=device.ver_os,
        device_model=device.device_model,
        user_agent=device.user_agent,
        status="active",
    )
    db.add(dbdevice)
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise
    db.refresh(dbdevice)
    return dbdevice


def update_user_device(db: Session, dbdevice: UserDevice, device: UserDeviceUpdate) -> UserDevice:
    if device.hwid is not None:
        dbdevice.hwid = device.hwid
    if device.device_os is not None:
        dbdevice.device_os = device.device_os
    if device.ver_os is not None:
        dbdevice.ver_os = device.ver_os
    if device.device_model is not None:
        dbdevice.device_model = device.device_model
    if device.user_agent is not None:
        dbdevice.user_agent = device.user_agent
    db.commit()
    db.refresh(dbdevice)
    return dbdevice


def delete_user_device(db: Session, dbdevice: UserDevice) -> None:
    db.delete(dbdevice)
    db.commit()


def revoke_user_device(db: Session, dbdevice: UserDevice) -> UserDevice:
    dbdevice.status = "revoked"
    dbdevice.last_seen = datetime.utcnow()
    db.commit()
    db.refresh(dbdevice)
    return dbdevice


def _update_unknown_device_metadata(
    dbdevice: UserDevice,
    device_os: str | None,
    ver_os: str | None,
    device_model: str | None,
    user_agent: str | None,
) -> None:
    dbdevice.device_os = device_os or dbdevice.device_os
    dbdevice.ver_os = ver_os or dbdevice.ver_os
    dbdevice.device_model = device_model or dbdevice.device_model
    dbdevice.user_agent = user_agent or dbdevice.user_agent
    if dbdevice.status == "revoked":
        dbdevice.status = "active"
    dbdevice.last_seen = datetime.utcnow()


def register_user_device(
    db: Session,
    dbuser: User,
    hwid: str | None,
    device_os: str | None,
    ver_os: str | None,
    device_model: str | None,
    user_agent: str | None,
    *,
    hard_mode: bool = False,
) -> tuple[bool, bool]:
    if not hwid:
        dbdevice = get_user_device_by_hwid(db, dbuser, UNKNOWN_DEVICE_HWID)
        if dbdevice:
            if _unknown_user_agents_match(cast(str | None, dbdevice.user_agent), user_agent):
                _update_unknown_device_metadata(dbdevice, device_os, ver_os, device_model, user_agent)
                db.commit()
                return True, False
            return False, True
        if _hard_mode_blocks_new_device(db, dbuser, hard_mode=hard_mode):
            return False, False
        dbdevice = UserDevice(
            user_id=dbuser.id,
            hwid=UNKNOWN_DEVICE_HWID,
            device_os=device_os,
            ver_os=ver_os,
            device_model=device_model,
            user_agent=user_agent,
            status="active",
        )
        db.add(dbdevice)
        try:
            db.commit()
        except IntegrityError:
            db.rollback()
            return True, False
        return True, False

    dbdevice = get_user_device_by_hwid(db, dbuser, hwid)
    if dbdevice:
        dbdevice.device_os = device_os or dbdevice.device_os
        dbdevice.ver_os = ver_os or dbdevice.ver_os
        dbdevice.device_model = device_model or dbdevice.device_model
        dbdevice.user_agent = user_agent or dbdevice.user_agent
        if dbdevice.status == "revoked":
            dbdevice.status = "active"
        dbdevice.last_seen = datetime.utcnow()
        db.commit()
        return True, False

    if _hard_mode_blocks_new_device(db, dbuser, hard_mode=hard_mode):
        return False, False

    dbdevice = UserDevice(
        user_id=dbuser.id,
        hwid=hwid,
        device_os=device_os,
        ver_os=ver_os,
        device_model=device_model,
        user_agent=user_agent,
        status="active",
    )
    db.add(dbdevice)
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        return True, False
    return True, False


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
    # Сбрасываем агрегатный БС-счётчик: иначе после reset usages юзер остаётся
    # над лимитом и review_bs_nodes держит его заблокированным. Блок (node_user_blocks)
    # снимет сама джоба на следующем тике (≤ JOB_REVIEW_BS_NODES_INTERVAL), заодно
    # вернув юзера на ноды в xray.
    db.query(NodeUserBsUsage).filter(NodeUserBsUsage.user_id == dbuser.id).delete(synchronize_session=False)
    if dbuser.status not in (UserStatus.expired or UserStatus.disabled):
        dbuser.status = UserStatus.active.value

    if dbuser.next_plan:
        db.delete(dbuser.next_plan)
        dbuser.next_plan = None
    db.add(dbuser)

    db.commit()
    db.refresh(dbuser)
    return dbuser


def reset_user_by_next(db: Session, dbuser: User, commit: bool = True) -> User:
    """
    Resets the data usage of a user based on next user.

    Args:
        db (Session): Database session.
        dbuser (User): The user object whose data usage is to be reset.
        commit (bool): Whether to commit the transaction immediately.

    Returns:
        User: The updated user object.
    """

    if dbuser.next_plan is None:
        # Контракт функции -> User: возвращаем самого пользователя без изменений,
        # а не None. Иначе вызывающий код (review job) пропускает None в xray
        # операции и report.* и роняет весь джоб.
        return dbuser

    usage_log = UserUsageResetLogs(
        user=dbuser,
        used_traffic_at_reset=dbuser.used_traffic,
    )
    db.add(usage_log)

    dbuser.node_usages.clear()
    dbuser.status = UserStatus.active.value

    dbuser.data_limit = dbuser.next_plan.data_limit + (
        0 if dbuser.next_plan.add_remaining_traffic else dbuser.data_limit - dbuser.used_traffic
    )
    dbuser.expire = dbuser.next_plan.expire

    dbuser.used_traffic = 0
    db.delete(dbuser.next_plan)
    dbuser.next_plan = None
    db.add(dbuser)

    if commit:
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
    # Clear stored subscription token to force regeneration on next request
    dbuser.subscription_token = None
    db.query(UserDevice).filter(UserDevice.user_id == dbuser.id).update(
        {UserDevice.status: "revoked"},
        synchronize_session=False,
    )

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
    # Backfill subscription_token for legacy users after migration
    if dbuser.subscription_token is None:
        dbuser.subscription_token = create_subscription_token(dbuser.username)

    db.commit()
    db.refresh(dbuser)
    return dbuser


def ensure_subscription_token(db: Session, dbuser: User) -> User:
    """
    Ensures the user has a persistent subscription token stored.
    If missing, generates one and persists it.
    """
    if dbuser.subscription_token is None:
        dbuser.subscription_token = create_subscription_token(dbuser.username)
        db.commit()
        db.refresh(dbuser)
    return dbuser


def reset_all_users_data_usage(db: Session, admin: Admin | None = None):
    """
    Resets the data usage for all users or users under a specific admin.

    Args:
        db (Session): Database session.
        admin (Optional[Admin]): Admin to filter users by, if any.
    """
    query = get_user_queryset(db)

    if admin:
        query = query.filter(User.admin == admin)

    users = query.all()
    for dbuser in users:
        dbuser.used_traffic = 0
        if dbuser.status not in [UserStatus.on_hold, UserStatus.expired, UserStatus.disabled]:
            dbuser.status = UserStatus.active
        dbuser.usage_logs.clear()
        dbuser.node_usages.clear()
        if dbuser.next_plan:
            db.delete(dbuser.next_plan)
            dbuser.next_plan = None
        db.add(dbuser)

    # Сбрасываем БС-счётчики этих юзеров — иначе review_bs_nodes держит блок
    # после массового reset (см. reset_user_data_usage).
    user_ids = [u.id for u in users]
    if user_ids:
        db.query(NodeUserBsUsage).filter(NodeUserBsUsage.user_id.in_(user_ids)).delete(synchronize_session=False)

    db.commit()


def disable_all_active_users(db: Session, admin: Admin | None = None):
    """
    Disable all active users or users under a specific admin.

    Args:
        db (Session): Database session.
        admin (Optional[Admin]): Admin to filter users by, if any.
    """
    query = db.query(User).filter(User.status.in_((UserStatus.active, UserStatus.on_hold)))
    if admin:
        query = query.filter(User.admin == admin)

    query.update(
        {User.status: UserStatus.disabled, User.last_status_change: datetime.utcnow()}, synchronize_session=False
    )

    db.commit()


def activate_all_disabled_users(db: Session, admin: Admin | None = None):
    """
    Activate all disabled users or users under a specific admin.

    Args:
        db (Session): Database session.
        admin (Optional[Admin]): Admin to filter users by, if any.
    """
    query_for_active_users = db.query(User).filter(User.status == UserStatus.disabled)
    query_for_on_hold_users = db.query(User).filter(
        and_(
            User.status == UserStatus.disabled,
            User.expire.is_(None),
            User.on_hold_expire_duration.isnot(None),
            User.online_at.is_(None),
        )
    )
    if admin:
        query_for_active_users = query_for_active_users.filter(User.admin == admin)
        query_for_on_hold_users = query_for_on_hold_users.filter(User.admin == admin)

    query_for_on_hold_users.update(
        {User.status: UserStatus.on_hold, User.last_status_change: datetime.utcnow()}, synchronize_session=False
    )
    query_for_active_users.update(
        {User.status: UserStatus.active, User.last_status_change: datetime.utcnow()}, synchronize_session=False
    )

    db.commit()


def autodelete_expired_users(db: Session, include_limited_users: bool = False) -> list[User]:
    """
    Deletes expired (optionally also limited) users whose auto-delete time has passed.

    Args:
        db (Session): Database session
        include_limited_users (bool, optional): Whether to delete limited users as well.
            Defaults to False.

    Returns:
        list[User]: List of deleted users.
    """
    target_status = [UserStatus.expired] if not include_limited_users else [UserStatus.expired, UserStatus.limited]

    auto_delete = coalesce(User.auto_delete_in_days, USERS_AUTODELETE_DAYS)

    query = (
        db.query(
            User,
            auto_delete,  # Use global auto-delete days as fallback
        )
        .filter(
            auto_delete >= 0,  # Negative values prevent auto-deletion
            User.status.in_(target_status),
        )
        .options(joinedload(User.admin))
    )

    # TODO: Handle time filter in query itself (NOTE: Be careful with sqlite's strange datetime handling)
    expired_users = [
        user
        for (user, auto_delete) in query
        if user.last_status_change + timedelta(days=auto_delete) <= datetime.utcnow()
    ]

    if expired_users:
        remove_users(db, expired_users)

    return expired_users


def get_all_users_usages(db: Session, admin: Admin, start: datetime, end: datetime) -> list[UserUsageResponse]:
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
    usages = {
        0: UserUsageResponse(  # Main Core
            node_id=None, node_name="Master", used_traffic=0
        )
    }

    for node in db.query(Node).all():
        usages[node.id] = UserUsageResponse(node_id=node.id, node_name=node.name, used_traffic=0)

    admin_users = set(user.id for user in get_users(db=db, admins=admin))

    cond = and_(
        NodeUserUsage.created_at >= start, NodeUserUsage.created_at <= end, NodeUserUsage.user_id.in_(admin_users)
    )

    for v in db.query(NodeUserUsage).filter(cond):
        try:
            usages[v.node_id or 0].used_traffic += v.used_traffic
        except KeyError:
            pass

    return list(usages.values())


def update_user_status(db: Session, dbuser: User, status: UserStatus, commit: bool = True) -> User:
    """
    Updates a user's status and records the time of change.

    Args:
        db (Session): Database session.
        dbuser (User): The user to update.
        status (UserStatus): The new status.
        commit (bool): Whether to commit the transaction immediately.

    Returns:
        User: The updated user object.
    """
    dbuser.status = status
    dbuser.last_status_change = datetime.utcnow()
    if commit:
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


def start_user_expire(db: Session, dbuser: User, commit: bool = True) -> User:
    """
    Starts the expiration timer for a user.

    Args:
        db (Session): Database session.
        dbuser (User): The user object whose expiration timer is to be started.
        commit (bool): Whether to commit the transaction immediately.

    Returns:
        User: The updated user object.
    """
    expire = int(datetime.utcnow().timestamp()) + dbuser.on_hold_expire_duration
    dbuser.expire = expire
    dbuser.on_hold_expire_duration = None
    dbuser.on_hold_timeout = None
    if commit:
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
        discord_webhook=admin.discord_webhook if admin.discord_webhook else None,
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


def get_admins(
    db: Session, offset: int | None = None, limit: int | None = None, username: str | None = None
) -> list[Admin]:
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
        query = query.filter(Admin.username.ilike(f"%{username}%"))
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
    if dbadmin.users_usage == 0:
        return dbadmin

    usage_log = AdminUsageLogs(admin=dbadmin, used_traffic_at_reset=dbadmin.users_usage)
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
    inbound_tags: list[str] = []
    for _, i in user_template.inbounds.items():
        inbound_tags.extend(i)
    dbuser_template = UserTemplate(
        name=user_template.name,
        data_limit=user_template.data_limit,
        expire_duration=user_template.expire_duration,
        username_prefix=user_template.username_prefix,
        username_suffix=user_template.username_suffix,
        inbounds=db.query(ProxyInbound).filter(ProxyInbound.tag.in_(inbound_tags)).all(),
    )
    db.add(dbuser_template)
    db.commit()
    db.refresh(dbuser_template)
    return dbuser_template


def update_user_template(
    db: Session, dbuser_template: UserTemplate, modified_user_template: UserTemplateModify
) -> UserTemplate:
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
        inbound_tags: list[str] = []
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


def get_user_templates(db: Session, offset: int | None = None, limit: int | None = None) -> list[UserTemplate]:
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


def get_node(db: Session, name: str) -> Node | None:
    """
    Retrieves a node by its name.

    Args:
        db (Session): The database session.
        name (str): The name of the node to retrieve.

    Returns:
        Optional[Node]: The Node object if found, None otherwise.
    """
    return db.query(Node).filter(Node.name == name).first()


def get_node_by_id(db: Session, node_id: int) -> Node | None:
    """
    Retrieves a node by its ID.

    Args:
        db (Session): The database session.
        node_id (int): The ID of the node to retrieve.

    Returns:
        Optional[Node]: The Node object if found, None otherwise.
    """
    return db.query(Node).filter(Node.id == node_id).first()


def get_nodes(db: Session, status: NodeStatus | list | None = None, enabled: bool = None) -> list[Node]:
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


def get_nodes_usage(db: Session, start: datetime, end: datetime) -> list[NodeUsageResponse]:
    """
    Retrieves usage data for all nodes within a specified time range.

    Args:
        db (Session): The database session.
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

    for node in db.query(Node).all():
        usages[node.id] = NodeUsageResponse(node_id=node.id, node_name=node.name, uplink=0, downlink=0)

    cond = and_(NodeUsage.created_at >= start, NodeUsage.created_at <= end)

    for v in db.query(NodeUsage).filter(cond):
        try:
            usages[v.node_id or 0].uplink += v.uplink
            usages[v.node_id or 0].downlink += v.downlink
        except KeyError:
            pass

    return list(usages.values())


def _sync_cascade_routes(db: Session, dbnode: Node, routes) -> None:
    """Переписать cascade_routes входной ноды из API-моделей CascadeRouteModel."""
    dbnode.cascade_routes = [
        CascadeRoute(
            exit_node_id=r.exit_node_id,
            entry_inbound_tag=get_or_create_inbound(db, r.entry_inbound_tag).tag,
            cascade_inbound_tag=get_or_create_inbound(db, r.cascade_inbound_tag).tag,
        )
        for r in routes
    ]


def _apply_node_role(dbnode: Node, role: NodeRole) -> None:
    """Установить роль; для exit сгенерировать cascade_params один раз (идемпотентно)."""
    dbnode.role = role
    if role == NodeRole.exit and not dbnode.cascade_params:
        dbnode.cascade_params = generate_cascade_identity()


def create_node(db: Session, node: NodeCreate) -> Node:
    """
    Creates a new node in the database.

    Args:
        db (Session): The database session.
        node (NodeCreate): The node creation model containing node details.

    Returns:
        Node: The newly created Node object.
    """
    dbnode = Node(name=node.name, address=node.address, port=node.port, api_port=node.api_port, protocol=node.protocol)

    if node.inbounds is not None:
        dbnode.inbounds = [get_or_create_inbound(db, tag) for tag in node.inbounds]

    _apply_node_role(dbnode, node.role)
    dbnode.is_bs = node.is_bs
    dbnode.cascade_balancer_strategy = node.cascade_balancer_strategy
    cast(Any, dbnode).hosting_traffic_limit_bytes = node.hosting_traffic_limit_bytes
    cast(Any, dbnode).owner_bot_id = node.owner_bot_id
    if node.cascade_routes is not None:
        _sync_cascade_routes(db, dbnode, node.cascade_routes)

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

    if modify.protocol is not None:
        dbnode.protocol = modify.protocol

    if modify.status is NodeStatus.disabled:
        dbnode.status = modify.status
        dbnode.xray_version = None
        dbnode.message = None
    else:
        dbnode.status = NodeStatus.connecting

    if modify.usage_coefficient:
        dbnode.usage_coefficient = modify.usage_coefficient

    if modify.inbounds is not None:
        dbnode.inbounds = [get_or_create_inbound(db, tag) for tag in modify.inbounds]

    if modify.role is not None:
        _apply_node_role(dbnode, modify.role)

    if modify.is_bs is not None:
        dbnode.is_bs = modify.is_bs

    if modify.cascade_balancer_strategy is not None:
        dbnode.cascade_balancer_strategy = modify.cascade_balancer_strategy

    if modify.cascade_routes is not None:
        _sync_cascade_routes(db, dbnode, modify.cascade_routes)

    if "hosting_traffic_limit_bytes" in modify.model_fields_set:
        cast(Any, dbnode).hosting_traffic_limit_bytes = modify.hosting_traffic_limit_bytes

    if "owner_bot_id" in modify.model_fields_set:
        cast(Any, dbnode).owner_bot_id = modify.owner_bot_id

    db.commit()
    db.refresh(dbnode)
    return dbnode


def get_master_inbound_tags(db: Session) -> list[str]:
    """Теги инбаундов, назначенных главному серверу (Master). Пусто ⇒ все инбаунды."""
    return [row[0] for row in db.query(master_inbounds_association.c.inbound_tag).all()]


def set_master_inbounds(db: Session, tags: list[str]) -> None:
    """Переустановить набор инбаундов Master (полная замена)."""
    for tag in tags:
        get_or_create_inbound(db, tag)  # гарантировать наличие inbounds.tag под FK
    db.execute(master_inbounds_association.delete())
    if tags:
        db.execute(master_inbounds_association.insert(), [{"inbound_tag": t} for t in tags])
    db.commit()


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


def get_bs_usage_totals(db: Session, user_id: int, yyyymm: str) -> int:
    """Агрегат БС-расхода юзера (сумма по is_bs-нодам) за текущий месяц в байтах."""
    from app.xray.bs_limit import aggregate_bs_usage

    rows = (
        db.query(
            NodeUserBsUsage.user_id,
            NodeUserBsUsage.monthly_used,
            NodeUserBsUsage.monthly_period,
        )
        .join(Node, Node.id == NodeUserBsUsage.node_id)
        .filter(
            Node.is_bs.is_(True),
            NodeUserBsUsage.user_id == user_id,
        )
        .all()
    )

    totals = aggregate_bs_usage(
        [{"user_id": r.user_id, "monthly_used": r.monthly_used, "monthly_period": r.monthly_period} for r in rows],
        yyyymm,
    )
    return totals.get(user_id, 0)


def get_bs_usage_totals_stale(db: Session, user_id: int, yyyymm: str, since: str) -> int:
    """Неучтённый БС-расход в полуинтервале [since, yyyymm).

    Нижняя граница обязательна: строка молчащей ноды может лежать со старым периодом
    годами, и без неё её расход вычитался бы из пула на каждой смене месяца заново.
    """
    total = (
        db.query(func.coalesce(func.sum(NodeUserBsUsage.monthly_used), 0))
        .join(Node, Node.id == NodeUserBsUsage.node_id)
        .filter(
            Node.is_bs.is_(True),
            NodeUserBsUsage.user_id == user_id,
            NodeUserBsUsage.monthly_period != yyyymm,
            NodeUserBsUsage.monthly_period >= since,
        )
        .scalar()
    )
    return int(total or 0)


def normalize_bs_extra_period(db: Session, user_id: int, monthly_limit: int, yyyymm: str, *, persist: bool) -> int:
    """Приводит купленный БС-пул к текущему месяцу и возвращает его.

    Период совпадает или пуст → no-op. persist=True пишет новое значение под
    SELECT ... FOR UPDATE в текущей транзакции (коммит — на вызывающем).

    Читаем колоночным select, а не ORM-сущностью: `Query.first()` по User блокировку
    берёт, но уже загруженный в identity map инстанс не перезаписывает, и под локом
    мы бы увидели снимок пула на начало HTTP-запроса вместо актуального значения.
    """
    from app.xray.bs_limit import carry_over_pool

    stmt = select(User.bs_extra, User.bs_extra_period).where(User.id == user_id)
    if persist:
        stmt = stmt.with_for_update()
    row = db.execute(stmt).first()
    if row is None:
        return 0
    pool, period = int(row.bs_extra or 0), cast("str | None", row.bs_extra_period)

    # period > yyyymm (гонка на границе суток UTC, скачок часов) тоже no-op: иначе
    # период откатится назад и следующий тик вычтет перерасход второй раз.
    if not period or period >= yyyymm:
        return pool

    new_pool = carry_over_pool(pool, get_bs_usage_totals_stale(db, user_id, yyyymm, period), monthly_limit)
    if persist:
        db.execute(update(User).where(User.id == user_id).values(bs_extra=new_pool, bs_extra_period=yyyymm))
    return new_pool


def get_bs_state(db: Session, dbuser: User) -> dict[str, int]:
    """Единая точка правды по БС-трафику пользователя. Не пишет в БД."""
    from app.services.panel_settings import get_bs_monthly_limit
    from app.xray.bs_limit import monthly_effective_limit, period_keys

    user_id = cast(int, dbuser.id)
    monthly_limit = get_bs_monthly_limit(db)
    yyyymm = period_keys(datetime.utcnow())
    pool = normalize_bs_extra_period(db, user_id, monthly_limit, yyyymm, persist=False)
    return {
        "monthly_used": get_bs_usage_totals(db, user_id, yyyymm),
        "monthly_limit": monthly_limit,
        "pool": pool,
        "limit_total": monthly_effective_limit(monthly_limit, pool) if monthly_limit else 0,
    }


def get_user_bs_traffic(db: Session, dbuser: User) -> dict[str, int]:
    """Сводка БС-трафика для API пользователя и внешних клиентов."""
    state = get_bs_state(db, dbuser)
    return {
        "monthly_used": state["monthly_used"],
        "monthly_limit": state["monthly_limit"],
        "monthly_limit_with_extra": state["limit_total"],
        "extra_bytes": state["pool"],
    }


def _bot_settings_for_user(db: Session, dbuser: User) -> dict[str, Any]:
    from app.db.models import BotSettings

    if not dbuser.bot_id:
        return apply_bot_settings_fallback(None)
    data = db.query(BotSettings.data).filter(BotSettings.bot_id == dbuser.bot_id).scalar()
    return apply_bot_settings_fallback(data)


def set_user_bs_extra_amount(db: Session, dbuser: User, extra_bytes: int) -> None:
    """Задать купленный БС-пул (bs_extra), без базового месячного лимита панели."""
    from app.services.panel_settings import get_bs_monthly_limit
    from app.xray.bs_limit import period_keys

    user_id = cast(int, dbuser.id)
    monthly_limit = get_bs_monthly_limit(db)
    yyyymm = period_keys(datetime.utcnow())
    if not monthly_limit:
        if extra_bytes:
            raise ValueError("Месячный лимит БС в настройках панели не задан (0)")
        new_extra = 0
    else:
        normalize_bs_extra_period(db, user_id, monthly_limit, yyyymm, persist=True)
        new_extra = max(0, int(extra_bytes))

    db.execute(update(User).where(User.id == user_id).values(bs_extra=new_extra, bs_extra_period=yyyymm))


def set_user_bs_limit_total(db: Session, dbuser: User, limit_total: int) -> None:
    """Задать суммарный месячный БС-потолок (база панели + купленный пул bs_extra)."""
    from app.services.panel_settings import get_bs_monthly_limit
    from app.xray.bs_limit import period_keys

    user_id = cast(int, dbuser.id)
    monthly_limit = get_bs_monthly_limit(db)
    yyyymm = period_keys(datetime.utcnow())
    if not monthly_limit:
        if limit_total:
            raise ValueError("Месячный лимит БС в настройках панели не задан (0)")
        new_extra = 0
    else:
        normalize_bs_extra_period(db, user_id, monthly_limit, yyyymm, persist=True)
        if int(limit_total) < monthly_limit:
            raise ValueError("Суммарный БС-лимит не может быть меньше месячного лимита панели")
        new_extra = int(limit_total) - monthly_limit

    db.execute(update(User).where(User.id == user_id).values(bs_extra=new_extra, bs_extra_period=yyyymm))


def reset_user_bs_extra_pool(db: Session, dbuser: User, *, commit: bool = True) -> User:
    """Обнуляет купленный пул bs_extra без проверки настроек (внутренний сброс)."""
    from app.xray.bs_limit import period_keys

    db.execute(
        update(User).where(User.id == dbuser.id).values(bs_extra=0, bs_extra_period=period_keys(datetime.utcnow()))
    )
    if commit:
        db.commit()
        db.refresh(dbuser)
    return dbuser


def modify_user_bs_extra(db: Session, dbuser: User, *, delta_bytes: int | None = None, reset: bool = False) -> User:
    """Инкремент или сброс купленного БС-пула (bs_extra)."""
    from app.xray.bs_limit import period_keys

    if reset:
        settings = _bot_settings_for_user(db, dbuser)
        if not settings.get("bs_extra_reset_pool_on_prolong", False):
            return dbuser
        return reset_user_bs_extra_pool(db, dbuser)
    elif delta_bytes is not None:
        from app.services.panel_settings import get_bs_monthly_limit

        monthly_limit = get_bs_monthly_limit(db)
        yyyymm = period_keys(datetime.utcnow())
        # Сначала перенос за прошлый месяц, потом покупка — иначе докупка легла бы
        # поверх ещё не пересчитанного пула.
        pool = normalize_bs_extra_period(db, cast(int, dbuser.id), monthly_limit, yyyymm, persist=True)
        db.execute(
            update(User).where(User.id == dbuser.id).values(bs_extra=pool + int(delta_bytes), bs_extra_period=yyyymm)
        )
    else:
        raise ValueError("either delta_bytes or reset must be provided")
    db.commit()
    db.refresh(dbuser)
    return dbuser


def get_blocked_bs_node_ids(db: Session, user_id: int) -> set[int]:
    """ID БС-нод, на которых юзер сейчас заблокирован по лимиту (node_user_blocks).

    Хост подписки соотносится с нодой по связи host_nodes (ProxyHost.nodes), а НЕ по
    адресу: адрес хоста может быть доменом (маскировка TLS/SNI), тогда как нода
    подключена по IP (NPVPN-1652). Инбаунд-теги в Marzban общие для всех нод и для
    матча не годятся. При блоке юзер теряет ноду целиком — глушим все её хосты."""
    rows = db.query(NodeUserBlock.node_id).filter(NodeUserBlock.user_id == user_id).all()
    return {node_id for (node_id,) in rows}


def rotate_user_addresses(db: Session, dbuser: User) -> User:
    """Сменить юзеру набор адресов немедленно, не дожидаясь автоматической ротации.

    Инкремент сдвига меняет эпоху этого юзера, а значит и результат выбора. Таблицы
    назначений нет, поэтому «ротация» — это одно число (NPVPN-2072).

    Проставляем время последней ротации (C1, NPVPN-2072): без него журнал
    (app/services/address_history.py: reconstruct) не может отличить "offset
    всегда был таким" от "offset менялся, старые сутки жили с другим значением"
    — и задним числом переписал бы эпоху всех прошлых суток текущим offset.
    """
    cast(Any, dbuser).address_rotation_offset = int(dbuser.address_rotation_offset or 0) + 1
    cast(Any, dbuser).address_rotation_offset_at = datetime.utcnow()
    db.commit()
    db.refresh(dbuser)
    return dbuser


def get_weight_snapshots_range(db: Session, first_day: int, last_day: int) -> dict[int, dict[int, float]]:
    """Сырые снимки весов за диапазон суток: epoch_index -> {node_id: weight} (NPVPN-2072).

    Именно СЫРЫЕ: подбор «ближайшего не позже» и отсев протухших делает вызывающий
    (журнал выдачи), потому что для каждого дня диапазона ответ свой. Захватывает
    WEIGHT_SNAPSHOT_MAX_AGE_DAYS суток до начала диапазона — иначе у первых дней не
    нашлось бы более раннего снимка, который живая выдача в тот день использовала.

    Нужен журналу, который строится сразу за десятки дней: поденный
    get_weight_snapshot давал бы столько же round-trip'ов подряд.
    """
    rows = (
        db.query(NodeWeightSnapshot.epoch_index, NodeWeightSnapshot.node_id, NodeWeightSnapshot.weight)
        .filter(
            NodeWeightSnapshot.epoch_index >= first_day - WEIGHT_SNAPSHOT_MAX_AGE_DAYS,
            NodeWeightSnapshot.epoch_index <= last_day,
        )
        .all()
    )
    by_day: dict[int, dict[int, float]] = {}
    for row in rows:
        by_day.setdefault(int(row.epoch_index), {})[int(row.node_id)] = float(row.weight)
    return by_day


def get_exhausted_node_ids(db: Session, cutoff_percent: int | None = None) -> frozenset[int]:
    """Ноды, достигшие порога месячного лимита хостера (NPVPN-2072).

    Порог — доля лимита (`HOSTING_USAGE_CUTOFF_PERCENT`, дефолт 90%), а не 100%: счётчик
    хостера расходится с нашим, и добор лимита до нуля оплачивается как перерасход.
    Сравнение делает БД, а не Python: строк мало, но тянуть весь парк нод на каждый
    промах TTL-кэша незачем.

    Ноды без лимита и без замера сюда не попадают — см. is_exhausted.
    """
    from app.xray.address_policy import cutoff_ratio

    ratio = cutoff_ratio(HOSTING_USAGE_CUTOFF_PERCENT if cutoff_percent is None else cutoff_percent)
    rows = (
        db.query(Node.id)
        .filter(
            Node.hosting_traffic_limit_bytes.isnot(None),
            Node.hosting_traffic_limit_bytes > 0,
            Node.hosting_used_bytes.isnot(None),
            Node.hosting_used_bytes >= Node.hosting_traffic_limit_bytes * ratio,
        )
        .all()
    )
    return frozenset(row.id for row in rows)


def get_node_limits(db: Session) -> dict[int, int]:
    """Месячные лимиты нод (id -> байты). Ноды без лимита не попадают.

    Нужен журналу (address_history): восстановить «была ли нода исчерпана в день X» по
    снимку весов можно только зная лимит — снимок хранит остаток, а не долю.
    """
    rows = db.query(Node.id, Node.hosting_traffic_limit_bytes).filter(Node.hosting_traffic_limit_bytes > 0).all()
    return {row.id: int(row.hosting_traffic_limit_bytes) for row in rows}


def get_weight_snapshot(db: Session, epoch_index: int) -> dict[int, float]:
    """Веса нод на указанные сутки: ближайший снимок не позже epoch_index.

    Точного снимка может не быть (скрипт или Prometheus лежали), поэтому берём
    последний доступный более ранний. Насколько он устарел — решает вызывающий код
    (NPVPN-2072).
    """
    latest = (
        db.query(func.max(NodeWeightSnapshot.epoch_index))
        .filter(NodeWeightSnapshot.epoch_index <= epoch_index)
        .scalar()
    )
    if latest is None:
        return {}
    # Пропущено больше WEIGHT_SNAPSHOT_MAX_AGE_DAYS суточных проходов — веса
    # недостоверны, выравниваем. Проверка до выборки строк: на каждом рендере подписки
    # устаревший снимок не должен стоить лишнего похода в БД (NPVPN-2072).
    if epoch_index - int(latest) > WEIGHT_SNAPSHOT_MAX_AGE_DAYS:
        return {}
    rows = (
        db.query(NodeWeightSnapshot.node_id, NodeWeightSnapshot.weight, NodeWeightSnapshot.epoch_index)
        .filter(NodeWeightSnapshot.epoch_index == latest)
        .all()
    )
    return {row.node_id: float(row.weight) for row in rows}


def get_active_pins(db: Session, user_id: int, now: datetime) -> dict[int, list[int]]:
    """Активные закрепления нод юзера: host_id -> node_ids (NPVPN-2072).

    Одним запросом на весь рендер подписки (горячий путь), не по хосту.
    Уникальности (user_id, host_id) на уровне БД нет намеренно — истёкшие пины
    остаются как история, по одной паре их может накопиться много. Берём только
    строки с expires_at > now и, если на пару (user_id, host_id) их несколько,
    самую свежую по created_at.
    """
    rows = (
        db.query(UserNodePin)
        .filter(UserNodePin.user_id == user_id, UserNodePin.expires_at > now)
        .order_by(UserNodePin.host_id, UserNodePin.created_at.asc(), UserNodePin.id.asc())
        .all()
    )
    pins: dict[int, list[int]] = {}
    for row in rows:
        pins[cast(int, row.host_id)] = list(cast(list[int], row.node_ids))
    return pins


def create_user_node_pin(
    db: Session,
    *,
    user_id: int,
    host_id: int,
    node_ids: list[int],
    expires_at: datetime,
    created_by: str,
    note: str | None,
) -> UserNodePin:
    """Ставит закрепление нод хоста за юзером (NPVPN-2072).

    Не трогает прежние строки на этот (user_id, host_id) — они остаются как
    история (см. docstring UserNodePin). Действующей всегда становится эта,
    самая свежая по created_at, — так её видят и get_active_pins, и
    get_pins_covering_day.
    """
    pin = UserNodePin(
        user_id=user_id,
        host_id=host_id,
        node_ids=node_ids,
        expires_at=expires_at,
        created_by=created_by,
        note=note,
    )
    db.add(pin)
    db.commit()
    db.refresh(pin)
    return pin


def delete_user_node_pin(db: Session, *, user_id: int, host_id: int, now: datetime) -> int:
    """Снимает действующее закрепление немедленно, не дожидаясь expires_at (NPVPN-2072).

    Строку не удаляем — это стёрло бы историю расследований. Вместо этого
    переносим expires_at на `now`: get_active_pins перестаёт видеть пин сразу
    же, а get_pins_covering_day для прошлых суток по-прежнему честно покажет,
    что в те сутки закрепление действовало. Возвращает число снятых строк
    (0 — снимать было нечего).
    """
    rows = (
        db.query(UserNodePin)
        .filter(UserNodePin.user_id == user_id, UserNodePin.host_id == host_id, UserNodePin.expires_at > now)
        .all()
    )
    for row in rows:
        cast(Any, row).expires_at = now
    db.commit()
    return len(rows)


def list_active_pins(db: Session, user_id: int, now: datetime) -> list[UserNodePin]:
    """Действующие закрепления юзера с полными полями — для админского списка (NPVPN-2072).

    В отличие от get_active_pins (плоский dict host_id -> node_ids для горячего
    пути рендера подписки), тут нужны все поля строки: expires_at, created_by,
    note. Если на хост несколько активных строк — берём самую свежую по
    created_at, тем же правилом, что и get_active_pins.
    """
    rows = (
        db.query(UserNodePin)
        .filter(UserNodePin.user_id == user_id, UserNodePin.expires_at > now)
        .order_by(UserNodePin.host_id, UserNodePin.created_at.asc(), UserNodePin.id.asc())
        .all()
    )
    latest: dict[int, UserNodePin] = {}
    for row in rows:
        latest[cast(int, row.host_id)] = row
    return list(latest.values())


def get_pins_covering_day(db: Session, user_id: int, day_start: datetime, day_end: datetime) -> dict[int, list[int]]:
    """Закрепления юзера, действовавшие в течение суток [day_start, day_end) (NPVPN-2072).

    В отличие от get_active_pins ("что действует сейчас") — отдельный запрос для
    восстановления истории: захватывает и уже истёкшие строки. Истёкшие строки
    специально не удаляются именно ради этого запроса. Пин считается
    действовавшим в сутки, если он был создан до конца суток и не истёк до их
    начала (`created_at < day_end and expires_at > day_start`). Если на пару
    (host_id) за эти сутки несколько строк — берём самую свежую по created_at.
    """
    rows = (
        db.query(UserNodePin)
        .filter(
            UserNodePin.user_id == user_id,
            UserNodePin.created_at < day_end,
            UserNodePin.expires_at > day_start,
        )
        .order_by(UserNodePin.host_id, UserNodePin.created_at.asc(), UserNodePin.id.asc())
        .all()
    )
    pins: dict[int, list[int]] = {}
    for row in rows:
        pins[cast(int, row.host_id)] = list(cast(list[int], row.node_ids))
    return pins


def write_host_composition_snapshot(db: Session, epoch_index: int, host_id: int, payload: list[dict]) -> None:
    """Идемпотентная запись состава хоста на сутки (NPVPN-2072).

    Первая запись дня выигрывает: при конфликте (epoch_index, host_id) строка НЕ
    перезаписывается — состав на эти сутки уже зафиксирован, переписать его задним
    числом значит соврать в истории расследований. Джоба ходит раз в час именно
    ради этого — идемпотентность делает лишние проходы бесплатными.

    Эквивалент "ON DUPLICATE KEY UPDATE epoch_index = epoch_index" из бота
    (scripts/prometheus_vpn_nodes_sd.py), но через SQLAlchemy Core, диалект-зависимо:
    панель крутится на MySQL в проде и на SQLite в тестах, а не на Postgres, как бот.

    Формат `payload`: список `{"node_id": int | None, "address": str}`. `node_id`
    равен `None`, когда адрес хоста статический (host.address задан, обычно
    маскировка под домен) — там нет соответствия "адрес <-> нода" по построению
    (см. `_host_payload` в app/jobs/snapshot_host_composition.py и комментарий в
    `AddressContext.pick` про то же самое несоответствие).

    Не коммитит сама: обходит десятки хостов за проход, и коммит на каждый хост
    был бы лишним round-trip'ом в джобе, которая ходит каждый час. Коммитить
    накопленные вставки — забота ВЫЗЫВАЮЩЕГО кода (см. snapshot_host_composition
    в app/jobs/snapshot_host_composition.py: там один явный db.commit() сразу
    после цикла записи, ДО вызова prune_host_composition_snapshots — коммит
    снимков не должен зависеть от того, удастся ли не связанная с ним по смыслу
    подчистка).
    """
    values = {"epoch_index": epoch_index, "host_id": host_id, "payload": payload}
    stmt: Any
    if db.bind is not None and db.bind.dialect.name == "mysql":
        mysql_stmt = mysql_insert(HostCompositionSnapshot).values(**values)
        # Условный UPDATE, который ничего не меняет — тот же трюк, что в боте.
        stmt = mysql_stmt.on_duplicate_key_update(epoch_index=mysql_stmt.inserted.epoch_index)
    else:
        sqlite_stmt = sqlite_insert(HostCompositionSnapshot).values(**values)
        stmt = sqlite_stmt.on_conflict_do_nothing(index_elements=["epoch_index", "host_id"])
    db.execute(stmt)


def get_host_composition(db: Session, epoch_index: int) -> dict[int, list[dict]]:
    """Состав всех хостов на указанные сутки: host_id -> [{"node_id", "address"}, ...].

    В отличие от get_weight_snapshot — точный снимок за epoch_index, без подбора
    ближайшего более раннего: состав нужен для расследования "что видел юзер в дату
    X", подмена суток чужим снимком там была бы не деградацией, а искажением ответа
    (NPVPN-2072).
    """
    rows = (
        db.query(HostCompositionSnapshot.host_id, HostCompositionSnapshot.payload)
        .filter(HostCompositionSnapshot.epoch_index == epoch_index)
        .all()
    )
    return {row.host_id: row.payload for row in rows}


def get_host_composition_range(db: Session, first_day: int, last_day: int) -> dict[int, dict[int, list[dict]]]:
    """Состав хостов за диапазон суток: epoch_index -> {host_id: payload} (NPVPN-2072).

    Журнал выдачи строится сразу за десятки дней (до ARCHIVE_RETENTION_DAYS), и
    поденный вызов get_host_composition означал бы столько же round-trip'ов подряд в
    синхронном обработчике запроса. Семантика точного снимка та же: подбора ближайших
    более ранних суток здесь нет.
    """
    rows = (
        db.query(
            HostCompositionSnapshot.epoch_index,
            HostCompositionSnapshot.host_id,
            HostCompositionSnapshot.payload,
        )
        .filter(
            HostCompositionSnapshot.epoch_index >= first_day,
            HostCompositionSnapshot.epoch_index <= last_day,
        )
        .all()
    )
    by_day: dict[int, dict[int, list[dict]]] = {}
    for row in rows:
        by_day.setdefault(cast(int, row.epoch_index), {})[cast(int, row.host_id)] = row.payload
    return by_day


def get_pins_covering_range(db: Session, user_id: int, range_start: datetime, range_end: datetime) -> list[UserNodePin]:
    """Закрепления юзера, пересекающиеся с диапазоном [range_start, range_end) (NPVPN-2072).

    Возвращает СТРОКИ, а не готовую карту по хостам: какие из них действовали в
    конкретные сутки, решает вызывающий (см. pins_on_day в address_history) — иначе
    диапазонный журнал снова ходил бы в БД на каждый день.
    """
    return (
        db.query(UserNodePin)
        .filter(
            UserNodePin.user_id == user_id,
            UserNodePin.created_at < range_end,
            UserNodePin.expires_at > range_start,
        )
        .order_by(UserNodePin.host_id, UserNodePin.created_at.asc(), UserNodePin.id.asc())
        .all()
    )


def prune_host_composition_snapshots(db: Session, epoch_index: int, retention_days: int) -> None:
    """Чистит снимки состава старше архивного горизонта расследований (NPVPN-2072).

    Тот же горизонт (90 дней), что применяется к снимкам весов на стороне бота.

    Коммитит САМА и ТОЛЬКО своё удаление — самодостаточна умышленно, а не как
    побочный эффект. Это НЕ распространяется на чужие изменения, накопленные в той
    же сессии до вызова (например, снимки из write_host_composition_snapshot):
    их обязан закоммитить тот, кто их писал, до того, как отдать сессию сюда —
    иначе падение подчистки (лок, таймаут) откатывает молча ещё и запись, которая
    с подчисткой по смыслу не связана.
    """
    db.query(HostCompositionSnapshot).filter(HostCompositionSnapshot.epoch_index < epoch_index - retention_days).delete(
        synchronize_session=False
    )
    db.commit()


def create_notification_reminder(
    db: Session, reminder_type: ReminderType, expires_at: datetime, user_id: int, threshold: int | None = None
) -> NotificationReminder:
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
        setattr(reminder, "threshold", threshold)
    db.add(reminder)
    db.commit()
    db.refresh(reminder)
    return reminder


def get_notification_reminder(
    db: Session, user_id: int, reminder_type: ReminderType, threshold: int | None = None
) -> NotificationReminder | None:
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
        NotificationReminder.user_id == user_id, NotificationReminder.type == reminder_type
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
    db: Session, user_id: int, reminder_type: ReminderType, threshold: int | None = None
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
        NotificationReminder.user_id == user_id, NotificationReminder.type == reminder_type
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
    query = db.query(func.count(User.id)).filter(User.online_at.isnot(None), User.online_at >= twenty_four_hours_ago)
    return query.scalar()


def get_global_setting(db: Session, key: str) -> dict[str, Any] | None:
    row = db.query(GlobalSetting).filter(GlobalSetting.key == key).first()
    if row is None or not row.data:
        return None
    return dict(row.data)


def upsert_global_setting(db: Session, key: str, data: dict[str, Any]) -> dict[str, Any]:
    row = db.query(GlobalSetting).filter(GlobalSetting.key == key).first()
    if row is None:
        row = GlobalSetting(key=key, data=data)
        db.add(row)
    else:
        cast(Any, row).data = data
    db.commit()
    db.refresh(row)
    return dict(row.data)


def get_managed_setting(db: Session, key: str) -> dict[str, Any] | None:
    row = db.query(ManagedSetting).filter(ManagedSetting.key == key).first()
    if row is None:
        return None
    return {
        "key": row.key,
        "scope": row.scope,
        "source": row.source,
        "version": row.version,
        "applied_at": row.applied_at,
    }


def is_managed(db: Session, key: str) -> bool:
    return db.query(ManagedSetting).filter(ManagedSetting.key == key).first() is not None


def upsert_managed_setting(db: Session, key: str, *, scope: str, source: str, version: str) -> dict[str, Any]:
    row = db.query(ManagedSetting).filter(ManagedSetting.key == key).first()
    if row is None:
        row = ManagedSetting(key=key, scope=scope, source=source, version=version)
        db.add(row)
    else:
        cast(Any, row).scope = scope
        cast(Any, row).source = source
        cast(Any, row).version = version
        cast(Any, row).applied_at = datetime.utcnow()
    db.commit()
    db.refresh(row)
    return {
        "key": row.key,
        "scope": row.scope,
        "source": row.source,
        "version": row.version,
        "applied_at": row.applied_at,
    }


def delete_managed_setting(db: Session, key: str) -> bool:
    row = db.query(ManagedSetting).filter(ManagedSetting.key == key).first()
    if row is None:
        return False
    db.delete(row)
    db.commit()
    return True

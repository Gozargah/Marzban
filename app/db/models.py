import os
from datetime import datetime
from typing import cast

from sqlalchemy import (
    JSON,
    BigInteger,
    Boolean,
    Column,
    Date,
    DateTime,
    Enum,
    Float,
    ForeignKey,
    Integer,
    String,
    Table,
    Text,
    UniqueConstraint,
    func,
)
from sqlalchemy.dialects.mysql import LONGTEXT
from sqlalchemy.ext.hybrid import hybrid_property
from sqlalchemy.orm import object_session, relationship
from sqlalchemy.sql.expression import select, text

from app import xray
from app.db.base import Base
from app.models.node import NodeBalancerStrategy, NodeProtocol, NodeRole, NodeStatus
from app.models.proxy import (
    ProxyHostALPN,
    ProxyHostFingerprint,
    ProxyHostSecurity,
    ProxyTypes,
)
from app.models.user import ReminderType, UserDataLimitResetStrategy, UserStatus

host_bot_association = Table(
    "host_bot_association",
    Base.metadata,
    Column("host_id", ForeignKey("hosts.id", ondelete="CASCADE"), primary_key=True),
    Column("bot_id", ForeignKey("bots.id", ondelete="CASCADE"), primary_key=True),
    # NPVPN-2044: с какого момента бот арендует этот хост. Свойство пары, а не
    # хоста: один хост может быть отдан нескольким ботам. NULL — привязка
    # служебная (поставили на время разбирательства), в счёт она не идёт.
    Column("rented_at", DateTime, nullable=True),
)

host_nodes_association = Table(
    "host_nodes",
    Base.metadata,
    Column("host_id", ForeignKey("hosts.id", ondelete="CASCADE"), primary_key=True),
    Column("node_id", ForeignKey("nodes.id", ondelete="CASCADE"), primary_key=True),
)


class Admin(Base):
    __tablename__ = "admins"

    id = Column(Integer, primary_key=True)
    username = Column(String(34), unique=True, index=True)
    hashed_password = Column(String(128))
    users = relationship("User", back_populates="admin")
    created_at = Column(DateTime, default=datetime.utcnow)
    is_sudo = Column(Boolean, default=False)
    password_reset_at = Column(DateTime, nullable=True)
    telegram_id = Column(BigInteger, nullable=True, default=None)
    discord_webhook = Column(String(1024), nullable=True, default=None)
    users_usage = Column(BigInteger, nullable=False, default=0)
    usage_logs = relationship("AdminUsageLogs", back_populates="admin")


class AdminUsageLogs(Base):
    __tablename__ = "admin_usage_logs"

    id = Column(Integer, primary_key=True)
    admin_id = Column(Integer, ForeignKey("admins.id"))
    admin = relationship("Admin", back_populates="usage_logs")
    used_traffic_at_reset = Column(BigInteger, nullable=False)
    reset_at = Column(DateTime, default=datetime.utcnow)


class Bot(Base):
    __tablename__ = "bots"

    id = Column(Integer, primary_key=True)
    username = Column(String(64), unique=True, index=True, nullable=False)
    title = Column(String(128), nullable=True, default=None)
    source_bot_id = Column(BigInteger, unique=True, index=True, nullable=True)
    admin_sync_enabled = Column(Boolean, nullable=False, default=True, server_default=text("1"))
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    users = relationship("User", back_populates="bot")
    settings = relationship("BotSettings", uselist=False, back_populates="bot", cascade="all, delete-orphan")
    hosts = relationship("ProxyHost", secondary=host_bot_association, back_populates="bots")


class BotSettings(Base):
    __tablename__ = "bot_settings"

    id = Column(Integer, primary_key=True)
    bot_id = Column(Integer, ForeignKey("bots.id", ondelete="CASCADE"), unique=True, nullable=False)
    data = Column(JSON, nullable=False, default=dict)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    bot = relationship("Bot", back_populates="settings")


class GlobalSetting(Base):
    __tablename__ = "global_settings"

    key = Column(String(64), primary_key=True)
    data = Column(JSON, nullable=False, default=dict)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class ManagedSetting(Base):
    __tablename__ = "managed_settings"

    key = Column(String(64), primary_key=True)
    scope = Column(String(16), nullable=False, default="global")
    source = Column(String(255), nullable=False, default="")
    version = Column(String(64), nullable=False, default="")
    applied_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


DEFAULT_CONFIG_SLUG = "default"
BS_CONFIG_SLUG = "bs"


class XrayTemplate(Base):
    """Редактируемый документ клиентского конфига — ПОЛНЫЙ самодостаточный v2ray-json.

    Видов документов больше нет (колонка kind выпилена в NPVPN-2024): общий шаблон
    перестал быть отдельной сущностью, в которую вклеивалась чужая секция routing.
    Любой документ целиком уезжает клиенту, `default` — тот, что достаётся хостам
    без собственной привязки.
    """

    __tablename__ = "xray_templates"

    id = Column(Integer, primary_key=True)
    slug = Column(String(64), nullable=False, unique=True)
    title = Column(String(128), nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    versions = relationship(
        "XrayTemplateVersion",
        back_populates="template",
        cascade="all, delete-orphan",
        passive_deletes=True,
        order_by="XrayTemplateVersion.version",
    )


class XrayTemplateVersion(Base):
    """Одна сохранённая редакция документа. Append-only: активна версия с максимальным version."""

    __tablename__ = "xray_template_versions"
    __table_args__ = (UniqueConstraint("template_id", "version"),)

    id = Column(Integer, primary_key=True)
    template_id = Column(Integer, ForeignKey("xray_templates.id", ondelete="CASCADE"), nullable=False, index=True)
    template = relationship("XrayTemplate", back_populates="versions", passive_deletes=True)
    version = Column(Integer, nullable=False)
    body = Column(LONGTEXT().with_variant(Text, "sqlite"), nullable=False, default="")
    comment = Column(String(255), nullable=True)
    author_admin_id = Column(Integer, ForeignKey("admins.id", ondelete="SET NULL"), nullable=True)
    # Снимок имени: переживает удаление админа, история остаётся читаемой.
    author_username = Column(String(34), nullable=False, default="")
    created_at = Column(DateTime, default=datetime.utcnow)


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True)
    username = Column(String(34, collation="NOCASE"), unique=True, index=True)
    proxies = relationship("Proxy", back_populates="user", cascade="all, delete-orphan")
    status = Column(Enum(UserStatus), nullable=False, default=UserStatus.active)
    used_traffic = Column(BigInteger, default=0)
    node_usages = relationship("NodeUserUsage", back_populates="user", cascade="all, delete-orphan")
    node_bs_usages = relationship("NodeUserBsUsage", back_populates="user", cascade="all, delete-orphan")
    notification_reminders = relationship("NotificationReminder", back_populates="user", cascade="all, delete-orphan")
    data_limit = Column(BigInteger, nullable=True)
    data_limit_reset_strategy = Column(
        Enum(UserDataLimitResetStrategy),
        nullable=False,
        default=UserDataLimitResetStrategy.no_reset,
    )
    usage_logs = relationship("UserUsageResetLogs", back_populates="user")  # maybe rename it to reset_usage_logs?
    # BigInteger, а не Integer: в MySQL Integer — это INT со сроком жизни до
    # 2038-01-19 03:14:07 (2147483647). Бессрочные подписки бота выставляют
    # именно этот потолок, и любое продление поверх него роняло UPDATE с
    # "Out of range value for column 'expire'" (NPVPN-1879).
    expire = Column(BigInteger, nullable=True)
    admin_id = Column(Integer, ForeignKey("admins.id"))
    admin = relationship("Admin", back_populates="users")
    sub_revoked_at = Column(DateTime, nullable=True, default=None)
    sub_updated_at = Column(DateTime, nullable=True, default=None)
    sub_last_user_agent = Column(String(512), nullable=True, default=None)
    subscription_token = Column(String(256), nullable=True, default=None)
    bot_id = Column(Integer, ForeignKey("bots.id"), nullable=True, index=True)
    bot = relationship("Bot", back_populates="users")
    created_at = Column(DateTime, default=datetime.utcnow)
    note = Column(String(500), nullable=True, default=None)
    online_at = Column(DateTime, nullable=True, default=None)
    on_hold_expire_duration = Column(BigInteger, nullable=True, default=None)
    on_hold_timeout = Column(DateTime, nullable=True, default=None)
    device_limit = Column(Integer, nullable=True, default=None)
    bs_extra = Column(BigInteger, nullable=True, default=None)
    bs_extra_period = Column(String(7), nullable=True, default=None)

    # Ручная ротация адресов: саппорт инкрементирует, подмножество меняется немедленно.
    # Одна колонка вместо таблицы назначений — выбор вычисляется, а не хранится.
    address_rotation_offset = Column(Integer, nullable=False, default=0, server_default=text("0"))
    # Момент ПОСЛЕДНЕЙ ротации (NPVPN-2072, C1). Не история всех ротаций — одно
    # значение, как и сам offset. Нужен журналу (app/services/address_history.py:
    # reconstruct), чтобы не подставлять СЕГОДНЯШНИЙ offset в эпоху прошлых суток:
    # инкремент offset задним числом меняет эпоху ВСЕХ дней, поэтому дни до этой
    # метки честно помечаются "не восстановимо", а не пересчитываются неверно.
    # NULL = ротаций не было вовсе (offset всегда был текущим — 0 изначально).
    address_rotation_offset_at = Column(DateTime, nullable=True, default=None)

    # * Positive values: User will be deleted after the value of this field in days automatically.
    # * Negative values: User won't be deleted automatically at all.
    # * NULL: Uses global settings.
    auto_delete_in_days = Column(Integer, nullable=True, default=None)

    edit_at = Column(DateTime, nullable=True, default=None)
    last_status_change = Column(DateTime, default=datetime.utcnow, nullable=True)

    next_plan = relationship("NextPlan", uselist=False, back_populates="user", cascade="all, delete-orphan")
    devices = relationship("UserDevice", back_populates="user", cascade="all, delete-orphan")

    @hybrid_property
    def reseted_usage(self) -> int:
        return int(sum([log.used_traffic_at_reset for log in self.usage_logs]))

    @reseted_usage.expression
    def reseted_usage(cls):
        return (
            select(func.sum(UserUsageResetLogs.used_traffic_at_reset))
            .where(UserUsageResetLogs.user_id == cls.id)
            .label("reseted_usage")
        )

    @property
    def lifetime_used_traffic(self) -> int:
        return int(sum([log.used_traffic_at_reset for log in self.usage_logs]) + self.used_traffic)

    def _bs_pool_state(self) -> tuple[int, int] | None:
        """(месячный лимит панели, нормализованный купленный пул) или None, если лимит не задан.

        Пул берём с самого инстанса — оба атрибута уже загружены, и внутри месяца
        метод не делает ни одного запроса кроме (закешированного на сессию)
        чтения глобального лимита. В БД за расходом идём только когда период пула
        отстал: тогда нужен агрегат ещё не списанного расхода прошлого месяца.

        Результат кешируется на инстансе по (пул, период, лимит, текущий месяц),
        чтобы список пользователей не ходил в БД дважды, а смена месяца на живом
        объекте не отдавала вчерашний пересчёт.
        """
        from sqlalchemy.orm import object_session

        from app.services.panel_settings import get_bs_monthly_limit
        from app.xray.bs_limit import carry_over_pool, period_keys

        db = object_session(self)
        monthly_limit = get_bs_monthly_limit(db)
        if not monthly_limit:
            return None

        raw_pool = int(self.bs_extra or 0)
        period = cast("str | None", self.bs_extra_period)
        yyyymm = period_keys(datetime.utcnow())
        cache_key = (raw_pool, period, monthly_limit, yyyymm)
        cached = self.__dict__.get("_bs_pool_state_cache")
        if cached is not None and cached[0] == cache_key:
            return cached[1]

        pool = raw_pool
        # Без сессии (detached-объект) агрегат не достать — отдаём заведомо
        # ненормализованный пул: если период отстал, потолок будет завышен до
        # ближайшего тика джобы учёта.
        if db is not None and period and period < yyyymm:
            from app.db.crud import get_bs_usage_totals_stale

            stale_used = get_bs_usage_totals_stale(db, cast(int, self.id), yyyymm, period)
            pool = carry_over_pool(pool, stale_used, monthly_limit)
        state = (monthly_limit, pool)
        self.__dict__["_bs_pool_state_cache"] = (cache_key, state)
        return state

    @property
    def bs_monthly_limit_total(self) -> int | None:
        """Месячный БС-потолок (лимит панели + купленный пул), None если лимит не задан."""
        from app.xray.bs_limit import monthly_effective_limit

        state = self._bs_pool_state()
        if state is None:
            return None
        monthly_limit, pool = state
        return monthly_effective_limit(monthly_limit, pool)

    @property
    def bs_extra_effective(self) -> int:
        """Купленный БС-пул текущего месяца без базового лимита панели.

        0, если пользователь ничего не докупал или лимит панели не задан.
        Период прошлого месяца уже приведён: из пула вычтен перерасход.
        """
        state = self._bs_pool_state()
        if state is None:
            return 0
        return state[1]

    @property
    def bs_monthly_used(self) -> int:
        """Агрегат БС-расхода за текущий месяц из node_user_bs_usage."""
        if self.bs_monthly_limit_total is None:
            return 0
        from app.xray.bs_limit import aggregate_bs_usage, period_keys

        yyyymm = period_keys(datetime.utcnow())
        totals = aggregate_bs_usage(
            [
                {
                    "user_id": row.user_id,
                    "monthly_used": row.monthly_used,
                    "monthly_period": row.monthly_period,
                }
                for row in (self.node_bs_usages or [])
            ],
            yyyymm,
        )
        return totals.get(self.id, 0)

    @property
    def last_traffic_reset_time(self):
        return self.usage_logs[-1].reset_at if self.usage_logs else self.created_at

    @property
    def excluded_inbounds(self):
        _ = {}
        for proxy in self.proxies:
            _[proxy.type] = [i.tag for i in proxy.excluded_inbounds]
        return _

    @property
    def inbounds(self):
        _ = {}
        for proxy in self.proxies:
            _[proxy.type] = []
            excluded_tags = [i.tag for i in proxy.excluded_inbounds]
            for inbound in xray.config.inbounds_by_protocol.get(proxy.type, []):
                if inbound["tag"] not in excluded_tags:
                    _[proxy.type].append(inbound["tag"])

        return _

    @property
    def bot_username(self):
        return self.bot.username if self.bot else None

    @property
    def subscription_url(self) -> str:
        """Absolute or path-only subscription link from bot domain / env prefix."""
        from app.subscription.bot_settings import resolve_bot_settings
        from app.subscription.subscription_url import build_subscription_url

        return build_subscription_url(
            cast(str | None, self.subscription_token),
            bot_settings=resolve_bot_settings(self),
        )


class UserDevice(Base):
    __tablename__ = "user_devices"
    __table_args__ = (UniqueConstraint("user_id", "hwid", name="uq_user_devices_user_id_hwid"),)

    id = Column(Integer, primary_key=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    user = relationship("User", back_populates="devices")
    hwid = Column(String(128), nullable=False)
    device_os = Column(String(64), nullable=True)
    ver_os = Column(String(64), nullable=True)
    device_model = Column(String(128), nullable=True)
    user_agent = Column(String(512), nullable=True)
    # Последний IP, с которого устройство запрашивало /sub (NPVPN-2148); IP наших нод не пишется.
    last_ip = Column(String(45), nullable=True)
    status = Column(String(16), nullable=False, default="active", server_default="active")
    first_seen = Column(DateTime, nullable=False, default=datetime.utcnow)
    last_seen = Column(DateTime, nullable=False, default=datetime.utcnow, onupdate=datetime.utcnow)


excluded_inbounds_association = Table(
    "exclude_inbounds_association",
    Base.metadata,
    Column("proxy_id", ForeignKey("proxies.id")),
    Column("inbound_tag", ForeignKey("inbounds.tag")),
)

template_inbounds_association = Table(
    "template_inbounds_association",
    Base.metadata,
    Column("user_template_id", ForeignKey("user_templates.id")),
    Column("inbound_tag", ForeignKey("inbounds.tag")),
)

node_inbounds_association = Table(
    "node_inbounds",
    Base.metadata,
    Column("node_id", ForeignKey("nodes.id", ondelete="CASCADE"), primary_key=True),
    Column("inbound_tag", ForeignKey("inbounds.tag", ondelete="CASCADE"), primary_key=True),
)

master_inbounds_association = Table(
    "master_inbounds",
    Base.metadata,
    Column("inbound_tag", ForeignKey("inbounds.tag", ondelete="CASCADE"), primary_key=True),
)


class CascadeRoute(Base):
    """Связь входной ноды с выходной по конкретному инбаунду (NPVPN-1472).

    entry_node → exit_node: трафик с entry_inbound_tag на входной заворачивается
    в cascade-outbound на exit_node через cascade_inbound_tag (каталожный инбаунд
    выходной). Одна входная → N строк (1→N).
    """

    __tablename__ = "cascade_routes"

    id = Column(Integer, primary_key=True)
    entry_node_id = Column(Integer, ForeignKey("nodes.id", ondelete="CASCADE"), nullable=False)
    exit_node_id = Column(Integer, ForeignKey("nodes.id", ondelete="CASCADE"), nullable=False)
    entry_inbound_tag = Column(String(256), ForeignKey("inbounds.tag", ondelete="CASCADE"), nullable=False)
    cascade_inbound_tag = Column(String(256), ForeignKey("inbounds.tag", ondelete="CASCADE"), nullable=False)

    exit_node = relationship("Node", foreign_keys=[exit_node_id])


class NextPlan(Base):
    __tablename__ = "next_plans"

    id = Column(Integer, primary_key=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    data_limit = Column(BigInteger, nullable=False)
    expire = Column(BigInteger, nullable=True)  # см. User.expire (NPVPN-1879)
    add_remaining_traffic = Column(Boolean, nullable=False, default=False, server_default="0")
    fire_on_either = Column(Boolean, nullable=False, default=True, server_default="0")

    user = relationship("User", back_populates="next_plan")


class UserTemplate(Base):
    __tablename__ = "user_templates"

    id = Column(Integer, primary_key=True)
    name = Column(String(64), nullable=False, unique=True)
    data_limit = Column(BigInteger, default=0)
    expire_duration = Column(BigInteger, default=0)  # in seconds
    username_prefix = Column(String(20), nullable=True)
    username_suffix = Column(String(20), nullable=True)

    inbounds = relationship("ProxyInbound", secondary=template_inbounds_association)


class UserUsageResetLogs(Base):
    __tablename__ = "user_usage_logs"

    id = Column(Integer, primary_key=True)
    user_id = Column(Integer, ForeignKey("users.id"))
    user = relationship("User", back_populates="usage_logs")
    used_traffic_at_reset = Column(BigInteger, nullable=False)
    reset_at = Column(DateTime, default=datetime.utcnow)


class Proxy(Base):
    __tablename__ = "proxies"
    __table_args__ = (UniqueConstraint("user_id", "type"),)

    id = Column(Integer, primary_key=True)
    user_id = Column(Integer, ForeignKey("users.id"))
    user = relationship("User", back_populates="proxies")
    type = Column(Enum(ProxyTypes), nullable=False)
    settings = Column(JSON, nullable=False)
    excluded_inbounds = relationship("ProxyInbound", secondary=excluded_inbounds_association)


class ProxyInbound(Base):
    __tablename__ = "inbounds"

    id = Column(Integer, primary_key=True)
    tag = Column(String(256), unique=True, nullable=False, index=True)
    hosts = relationship("ProxyHost", back_populates="inbound", cascade="all, delete-orphan")


class ProxyHost(Base):
    __tablename__ = "hosts"
    # __table_args__ = (
    #     UniqueConstraint('inbound_tag', 'remark'),
    # )

    id = Column(Integer, primary_key=True)
    remark = Column(String(256), unique=False, nullable=False)
    address = Column(String(256), unique=False, nullable=False)
    port = Column(Integer, nullable=True)
    path = Column(String(256), unique=False, nullable=True)
    sni = Column(String(1000), unique=False, nullable=True)
    host = Column(String(1000), unique=False, nullable=True)
    security = Column(
        Enum(ProxyHostSecurity),
        unique=False,
        nullable=False,
        default=ProxyHostSecurity.inbound_default,
    )
    alpn = Column(
        Enum(ProxyHostALPN),
        unique=False,
        nullable=False,
        default=ProxyHostSecurity.none,
        server_default=ProxyHostSecurity.none.name,
    )
    fingerprint = Column(
        Enum(ProxyHostFingerprint),
        unique=False,
        nullable=False,
        default=ProxyHostSecurity.none,
        server_default=ProxyHostSecurity.none.name,
    )

    inbound_tag = Column(String(256), ForeignKey("inbounds.tag"), nullable=False)
    inbound = relationship("ProxyInbound", back_populates="hosts")
    order = Column(Integer, nullable=False, server_default="0", default=0)
    allowinsecure = Column(Boolean, nullable=True)
    is_disabled = Column(Boolean, nullable=True, default=False)
    mux_enable = Column(Boolean, nullable=False, default=False, server_default="0")
    fragment_setting = Column(String(100), nullable=True)
    noise_setting = Column(String(2000), nullable=True)
    random_user_agent = Column(Boolean, nullable=False, default=False, server_default="0")
    use_sni_as_host = Column(Boolean, nullable=False, default=False, server_default="0")
    xhttp_extra = Column(JSON, nullable=True)
    # NPVPN-2072: сужение адресов настраивается ПО ХОСТУ, а не по боту — у локаций разное
    # число нод и разная ценность: на одной юзеру осмысленно отдать два адреса, на другой
    # три. NULL/0 в size = не сужать.
    address_subset_enabled = Column(Boolean, nullable=False, default=False, server_default="0")
    address_subset_size = Column(Integer, nullable=True)
    address_rotation_days = Column(Integer, nullable=True)
    bots = relationship("Bot", secondary=host_bot_association, back_populates="hosts")

    @property
    def bot_usernames(self):
        return [bot.username for bot in self.bots]

    @property
    def rented_bot_usernames(self):
        """Боты, для которых этот хост отмечен арендованным (NPVPN-2044).

        Источник колонки «арендованные хосты» в счёте: привязка без `rented_at` —
        служебная (поставили на время разбирательства) и в счёт не идёт.
        """
        session = object_session(self)
        if session is None:
            return []
        rented_ids = set(
            session.execute(
                select(host_bot_association.c.bot_id).where(
                    host_bot_association.c.host_id == self.id,
                    host_bot_association.c.rented_at.isnot(None),
                )
            ).scalars()
        )
        return [bot.username for bot in self.bots if bot.id in rented_ids]

    nodes = relationship("Node", secondary=host_nodes_association, passive_deletes=True)

    @property
    def node_ids(self):
        return [node.id for node in self.nodes]

    # Документ клиентского конфига этого хоста. NULL — фолбэк на документ `default`
    # (см. select_config). Живёт на хосте, а не на ноде: хост — это отдельный
    # сервер в подписке, и одна нода может обслуживать несколько хостов с разными
    # конфигами. nodes.is_bs остаётся исключительно про БС-лимит трафика (NPVPN-2024).
    client_config_id = Column(
        Integer, ForeignKey("xray_templates.id", ondelete="SET NULL"), nullable=True, default=None
    )


class System(Base):
    __tablename__ = "system"

    id = Column(Integer, primary_key=True)
    uplink = Column(BigInteger, default=0)
    downlink = Column(BigInteger, default=0)


class JWT(Base):
    __tablename__ = "jwt"

    id = Column(Integer, primary_key=True)
    secret_key = Column(String(64), nullable=False, default=lambda: os.urandom(32).hex())


class TLS(Base):
    __tablename__ = "tls"

    id = Column(Integer, primary_key=True)
    key = Column(String(4096), nullable=False)
    certificate = Column(String(2048), nullable=False)


class Node(Base):
    __tablename__ = "nodes"

    id = Column(Integer, primary_key=True)
    name = Column(String(256, collation="NOCASE"), unique=True)
    address = Column(String(256), unique=False, nullable=False)
    port = Column(Integer, unique=False, nullable=False)
    api_port = Column(Integer, unique=False, nullable=False)
    protocol = Column(
        Enum(NodeProtocol),
        nullable=False,
        default=NodeProtocol.rest,
        server_default=NodeProtocol.rest.value,
    )
    xray_version = Column(String(32), nullable=True)
    status = Column(Enum(NodeStatus), nullable=False, default=NodeStatus.connecting)
    last_status_change = Column(DateTime, default=datetime.utcnow)
    message = Column(String(1024), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    uplink = Column(BigInteger, default=0)
    downlink = Column(BigInteger, default=0)
    user_usages = relationship("NodeUserUsage", back_populates="node", cascade="all, delete-orphan")
    usages = relationship("NodeUsage", back_populates="node", cascade="all, delete-orphan")
    usage_coefficient = Column(Float, nullable=False, server_default=text("1.0"), default=1)
    inbounds = relationship(
        "ProxyInbound",
        secondary=node_inbounds_association,
        passive_deletes=True,
    )
    role = Column(
        Enum(NodeRole),
        nullable=False,
        default=NodeRole.direct,
        server_default=NodeRole.direct.value,
    )
    cascade_params = Column(JSON, nullable=True)
    cascade_routes = relationship(
        "CascadeRoute",
        foreign_keys="CascadeRoute.entry_node_id",
        cascade="all, delete-orphan",
        passive_deletes=True,
    )
    cascade_balancer_strategy = Column(
        # values_callable: persist enum *values* (e.g. "leastLoad"), not member
        # names ("least_load"). The migration declares the SQL ENUM by value, so
        # without this SQLAlchemy would send names and MySQL truncates the column.
        Enum(NodeBalancerStrategy, values_callable=lambda obj: [e.value for e in obj]),
        nullable=False,
        default=NodeBalancerStrategy.random,
        server_default=NodeBalancerStrategy.random.value,
    )
    is_bs = Column(Boolean, nullable=False, default=False, server_default=text("0"))
    # Чей это сервер (NPVPN-2044). NULL — нода наша, её трафик идёт в счёт
    # партнёрам (is_bs=True на такой ноде — это «у нас арендован БС-лимит»).
    # Непусто — нода принадлежит этому боту: он платит за сервер сам, и в счёт
    # её трафик не должен попадать, даже когда is_bs=True (лимит на ней всё
    # равно действует для пользователей бота). is_bs продолжает означать
    # ИСКЛЮЧИТЕЛЬНО действие БС-лимита — владелец это отдельный, независимый
    # признак. SET NULL, не CASCADE: удаление бота не должно удалять ноду.
    owner_bot_id = Column(Integer, ForeignKey("bots.id", ondelete="SET NULL"), nullable=True, index=True)
    # Лимит трафика у хостера на этот сервер (SI-байты). NULL — лимита нет.
    hosting_traffic_limit_bytes = Column(BigInteger, nullable=True)
    # Израсходованный NIC-трафик за месяц. Панель его сама не знает: это счётчик
    # node_exporter, который скрейпит Prometheus. Пишет scripts/prometheus_vpn_nodes_sd.py
    # из репозитория бота — он единственный видит оба берега (NPVPN-2072).
    hosting_used_bytes = Column(BigInteger, nullable=True)
    hosting_used_at = Column(DateTime, nullable=True)
    hosting_nic_daily = relationship(
        "NodeHostingNicDaily",
        back_populates="node",
        cascade="all, delete-orphan",
    )
    # NodeWeightSnapshot больше НЕ связана FK-каскадом с этой таблицей (I3,
    # NPVPN-2072) — снимок это архив журнала (app/services/address_history.py),
    # который обязан пережить удаление ноды, поэтому и ORM-relationship сюда не
    # заводим: cascade="all, delete-orphan" стёр бы архив вместе с нодой, а
    # именно это I3 и запрещает. Node.id, оставшийся в снимке после удаления
    # ноды, — не баг, ожидаемый "висячий" идентификатор архивной записи.


class NodeUserUsage(Base):
    __tablename__ = "node_user_usages"
    __table_args__ = (UniqueConstraint("created_at", "user_id", "node_id"),)

    id = Column(Integer, primary_key=True)
    created_at = Column(DateTime, unique=False, nullable=False)  # one hour per record
    user_id = Column(Integer, ForeignKey("users.id"))
    user = relationship("User", back_populates="node_usages")
    node_id = Column(Integer, ForeignKey("nodes.id"))
    node = relationship("Node", back_populates="user_usages")
    used_traffic = Column(BigInteger, default=0)
    # Момент последнего тика, в котором по этой паре (user, node) реально шёл
    # трафик. created_at округлён до часа и потому не отличает «сидит сейчас»
    # от «пинганул 55 минут назад» — дашборд присутствия смотрит сюда (NPVPN-1966).
    last_seen_at = Column(DateTime, nullable=True, default=None)


class NodeUserBsUsage(Base):
    """По-нодный инкрементальный счётчик расхода для БС-нод (NPVPN-1456).
    Ленивый сброс периодов при инкременте; единственный writer — record_usages."""

    __tablename__ = "node_user_bs_usage"
    __table_args__ = (UniqueConstraint("node_id", "user_id", name="uq_node_user_bs_usage"),)

    id = Column(Integer, primary_key=True)
    node_id = Column(Integer, ForeignKey("nodes.id", ondelete="CASCADE"), nullable=False, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    monthly_used = Column(BigInteger, nullable=False, default=0, server_default=text("0"))
    monthly_period = Column(String(7), nullable=True)  # "YYYY-MM"
    user = relationship("User", back_populates="node_bs_usages")


class BotBsDaily(Base):
    """Суточный расход БС-трафика по боту и ноде (NPVPN-2044).

    Источник колонки «БС-трафик» в счёте партнёру. Считать можно и из сырого
    node_user_usages, но тогда счета держатся на том, что никто не выставит
    NODE_USER_USAGE_RETENTION_DAYS, — а та таблица 11 ГБ и растёт на 1.6 млн
    строк в месяц. Здесь 27 ботов x 4 БС-ноды x 365 дней ~= 39 тысяч строк в год,
    и ретеншн не нужен вовсе.

    bot_id и node_id НАРОЧНО без FK — та же причина, что у NodeWeightSnapshot и
    HostCompositionSnapshot: это архивная запись, а не текущее состояние.
    Удаление ноды или бота не должно стирать трафик, за который партнёру уже
    выставили счёт; иначе прошлый период молча обнулится и будет выглядеть как
    «трафика не было». Индексы на месте, ссылочной целостности нет.

    Зерно с нодой, а не только с ботом: при споре «откуда 527 ГБ» надо отвечать
    «вот на этих локациях», а стоимость та же.

    billable — считать ли эту строку в счёте партнёру (NPVPN-2044.1). Часть
    БС-нод принадлежит самим партнёрам (они сами платят за сервер, is_bs=True
    у ноды — только про действующий на ней лимит), и их трафик в счёт не идёт.
    Признак зафиксирован ЗДЕСЬ, в момент записи агрегата, а не выводится
    джойном на nodes.owner_bot_id при построении отчёта: джойн бы означал, что
    (а) удаление ноды тихо убирает её трафик из счёта и (б) смена владельца
    ноды переклассифицирует задним числом все прошлые периоды — оба случая
    это молчаливое изменение уже выставленных счетов, что здесь запрещено тем
    же принципом, что и у bot_id/node_id без FK выше. Строки партнёрских нод
    ПИШУТСЯ (billable=False), а не пропускаются — агрегат должен отвечать на
    «откуда 527 ГБ» по всем локациям, даже тем, что не идут в счёт.
    """

    __tablename__ = "bot_bs_daily"
    __table_args__ = (UniqueConstraint("bot_id", "node_id", "day", name="uq_bot_bs_daily"),)

    id = Column(Integer, primary_key=True)
    bot_id = Column(Integer, nullable=False, index=True)
    node_id = Column(Integer, nullable=False, index=True)
    day = Column(Date, nullable=False, index=True)
    used_bytes = Column(BigInteger, nullable=False, default=0, server_default=text("0"))
    billable = Column(Boolean, nullable=False, default=True, server_default=text("1"))


class NodeUserBlock(Base):
    """Текущее состояние по-нодных блокировок (NPVPN-1456).
    Единственный writer — review_bs_nodes; period: 'day'|'month' (диагностика)."""

    __tablename__ = "node_user_blocks"
    __table_args__ = (UniqueConstraint("node_id", "user_id", name="uq_node_user_blocks"),)

    id = Column(Integer, primary_key=True)
    node_id = Column(Integer, ForeignKey("nodes.id", ondelete="CASCADE"), nullable=False, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    period = Column(String(8), nullable=False)
    created_at = Column(DateTime, nullable=False, default=datetime.utcnow)


class NodeWeightSnapshot(Base):
    """Суточный снимок веса ноды = остаток лимита хостера (NPVPN-2072).

    Вес обязан быть постоянным внутри эпохи юзера, иначе подмножество адресов плывёт
    и у клиента скачут IP. Снимков хранится несколько, потому что ротация размазана по
    юзерам: каждый берёт тот, что действовал на начало ЕГО эпохи.

    Единственный writer — scripts/prometheus_vpn_nodes_sd.py (репозиторий бота).

    node_id НАРОЧНО без FK (I3, NPVPN-2072): это архивная запись журнала
    (app/services/address_history.py), а не текущее состояние. Удаление ноды не
    должно стирать её прошлые веса — иначе локация просто ИСЧЕЗАЕТ из истории
    без пометки, и недостача читается саппортом как "такого не было", хотя
    правда в том, что запись стёрлась вместе с нодой. Поэтому node_id может
    "повиснуть" (ссылаться на уже удалённую ноду) — reconstruct умеет работать
    с этим: снимок весов ищется по (epoch_index, node_id) независимо от того,
    жива ли ещё сама Node. Индекс на node_id сохранён (нужен для выборок),
    просто без ограничения ссылочной целостности.
    """

    __tablename__ = "node_weight_snapshots"
    __table_args__ = (UniqueConstraint("epoch_index", "node_id", name="uq_node_weight_snapshots"),)

    id = Column(Integer, primary_key=True)
    epoch_index = Column(Integer, nullable=False, index=True)
    node_id = Column(Integer, nullable=False, index=True)
    weight = Column(BigInteger, nullable=False, default=0)


class HostCompositionSnapshot(Base):
    """Суточный снимок состава хоста: какие ноды и адреса он в этот день представлял.

    Нужен, чтобы восстановить выдачу задним числом. Снимок, а не журнал событий:
    состав меняется четырьмя разными путями (привязка нод, статус ноды, её адрес,
    статическая строка host.address), и инструментировать каждый — четыре способа
    забыть один из них (NPVPN-2072).

    host_id НАРОЧНО без FK (I3, NPVPN-2072) — та же причина, что у
    NodeWeightSnapshot.node_id: это архив журнала, а CASCADE на удалении хоста
    стёр бы снимки состава вместе с ним, и локация молча ИСЧЕЗЛА бы из истории
    вместо явной пометки "хост удалён". host_id может "повиснуть", это
    ожидаемо — reconstruct читает снимок по (epoch_index, host_id) и не требует
    живого ProxyHost. Индекс на host_id сохранён, ссылочная целостность — нет.
    """

    __tablename__ = "host_composition_snapshots"
    __table_args__ = (UniqueConstraint("epoch_index", "host_id", name="uq_host_composition_snapshots"),)

    id = Column(Integer, primary_key=True)
    epoch_index = Column(Integer, nullable=False, index=True)
    host_id = Column(Integer, nullable=False, index=True)
    # [{"node_id": int | None, "address": str}, ...] в порядке выдачи. node_id = None
    # для статического host.address: там нет соответствия "адрес <-> нода" по
    # построению (см. app/jobs/snapshot_host_composition.py:_host_payload).
    payload = Column(JSON, nullable=False)


class UserNodePin(Base):
    """Закрепление конкретных нод за юзером в пределах одного хоста (NPVPN-2072).

    Заменяет автовыбор целиком: для этого хоста юзер получает ровно заданные ноды.
    Срок годности обязателен — пин ставят на время разбирательства и забывают снять,
    а через год никто не вспомнит, почему юзер сидит на странных нодах.

    Истёкшие строки не удаляются: они и есть история закреплений для журнала.
    """

    __tablename__ = "user_node_pins"

    id = Column(Integer, primary_key=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    host_id = Column(Integer, ForeignKey("hosts.id", ondelete="CASCADE"), nullable=False, index=True)
    node_ids = Column(JSON, nullable=False)
    created_at = Column(DateTime, nullable=False, default=datetime.utcnow)
    expires_at = Column(DateTime, nullable=False)
    created_by = Column(String(64), nullable=False)
    note = Column(String(500), nullable=True)
    user = relationship("User", passive_deletes=True)
    host = relationship("ProxyHost", passive_deletes=True)


class NodeHostingNicDaily(Base):
    """Суточный NIC in+out на VPN-ноде (календарный день MSK).

    Пишет scripts/prometheus_vpn_nodes_sd.py из Prometheus; панель суммирует
    строки за выбранный диапазон дат в «Использование узлов».
    """

    __tablename__ = "node_hosting_nic_daily"
    __table_args__ = (UniqueConstraint("node_id", "day", name="uq_node_hosting_nic_daily"),)

    id = Column(Integer, primary_key=True)
    node_id = Column(Integer, ForeignKey("nodes.id", ondelete="CASCADE"), nullable=False, index=True)
    node = relationship("Node", back_populates="hosting_nic_daily")
    day = Column(Date, nullable=False, index=True)
    used_bytes = Column(BigInteger, nullable=False, default=0, server_default=text("0"))
    updated_at = Column(DateTime, nullable=True)


class NodeUsage(Base):
    __tablename__ = "node_usages"
    __table_args__ = (UniqueConstraint("created_at", "node_id"),)

    id = Column(Integer, primary_key=True)
    created_at = Column(DateTime, unique=False, nullable=False)  # one hour per record
    node_id = Column(Integer, ForeignKey("nodes.id"))
    node = relationship("Node", back_populates="usages")
    uplink = Column(BigInteger, default=0)
    downlink = Column(BigInteger, default=0)


class NotificationReminder(Base):
    __tablename__ = "notification_reminders"

    id = Column(Integer, primary_key=True)
    user_id = Column(Integer, ForeignKey("users.id"))
    user = relationship("User", back_populates="notification_reminders")
    type = Column(Enum(ReminderType), nullable=False)
    threshold = Column(Integer, nullable=True)
    expires_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

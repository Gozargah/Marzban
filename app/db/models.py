import os
from datetime import datetime as dt, timezone as tz
from enum import Enum
from typing import Any, Dict, List, Optional

from sqlalchemy import (
    JSON,
    BigInteger,
    Column,
    DateTime,
    Enum as SQLEnum,
    Float,
    ForeignKey,
    String,
    Table,
    UniqueConstraint,
    and_,
    case,
    event,
    func,
    or_,
)
from sqlalchemy.ext.hybrid import hybrid_property
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.sql.expression import delete, select, text

from app.db.base import Base
from app.db.compiles_types import CaseSensitiveString, DaysDiff, EnumArray
from config import USER_SUBSCRIPTION_CLIENTS_LIMIT

inbounds_groups_association = Table(
    "inbounds_groups_association",
    Base.metadata,
    Column("inbound_id", ForeignKey("inbounds.id"), primary_key=True),
    Column("group_id", ForeignKey("groups.id"), primary_key=True),
)

users_groups_association = Table(
    "users_groups_association",
    Base.metadata,
    Column("user_id", ForeignKey("users.id"), primary_key=True),
    Column("groups_id", ForeignKey("groups.id"), primary_key=True),
)


class Admin(Base):
    __tablename__ = "admins"

    id: Mapped[int] = mapped_column(primary_key=True, init=False)
    created_at: Mapped[dt] = mapped_column(DateTime(timezone=True), default=lambda: dt.now(tz.utc), init=False)
    username: Mapped[str] = mapped_column(String(34), unique=True, index=True)
    hashed_password: Mapped[str] = mapped_column(String(128))
    users: Mapped[List["User"]] = relationship(back_populates="admin", init=False, default_factory=list)
    usage_logs: Mapped[List["AdminUsageLogs"]] = relationship(back_populates="admin", init=False, default_factory=list)
    is_sudo: Mapped[bool] = mapped_column(default=False)
    password_reset_at: Mapped[Optional[dt]] = mapped_column(DateTime(timezone=True), default=None)
    telegram_id: Mapped[Optional[int]] = mapped_column(BigInteger, default=None)
    discord_webhook: Mapped[Optional[str]] = mapped_column(String(1024), default=None)
    discord_id: Mapped[Optional[int]] = mapped_column(BigInteger, default=None)
    used_traffic: Mapped[int] = mapped_column(BigInteger, default=0)
    is_disabled: Mapped[bool] = mapped_column(server_default="0", default=False)
    sub_template: Mapped[Optional[str]] = mapped_column(String(1024), default=None)
    sub_domain: Mapped[Optional[str]] = mapped_column(String(256), default=None)
    profile_title: Mapped[Optional[str]] = mapped_column(String(512), default=None)
    support_url: Mapped[Optional[str]] = mapped_column(String(1024), default=None)

    @hybrid_property
    def reseted_usage(self) -> int:
        return int(sum([log.used_traffic_at_reset for log in self.usage_logs]))

    @reseted_usage.expression
    def reseted_usage(cls):
        return (
            select(func.sum(AdminUsageLogs.used_traffic_at_reset))
            .where(AdminUsageLogs.admin_id == cls.id)
            .label("reseted_usage")
        )

    @property
    def lifetime_used_traffic(self) -> int:
        return self.reseted_usage + self.used_traffic

    @property
    def total_users(self) -> int:
        return len(self.users)


class AdminUsageLogs(Base):
    __tablename__ = "admin_usage_logs"

    id: Mapped[int] = mapped_column(primary_key=True, init=False)
    admin_id: Mapped[int] = mapped_column(ForeignKey("admins.id"))
    admin: Mapped["Admin"] = relationship(back_populates="usage_logs", init=False)
    used_traffic_at_reset: Mapped[int] = mapped_column(BigInteger, nullable=False)
    reset_at: Mapped[dt] = mapped_column(DateTime(timezone=True), default=lambda: dt.now(tz.utc), init=False)


class ReminderType(str, Enum):
    expiration_date = "expiration_date"
    data_usage = "data_usage"


class UserStatus(str, Enum):
    active = "active"
    disabled = "disabled"
    limited = "limited"
    expired = "expired"
    on_hold = "on_hold"


class UserDataLimitResetStrategy(str, Enum):
    no_reset = "no_reset"
    day = "day"
    week = "week"
    month = "month"
    year = "year"


class User(Base):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(primary_key=True, init=False)
    created_at: Mapped[dt] = mapped_column(DateTime(timezone=True), default=lambda: dt.now(tz.utc), init=False)
    username: Mapped[str] = mapped_column(CaseSensitiveString(128), unique=True, index=True)
    node_usages: Mapped[List["NodeUserUsage"]] = relationship(
        back_populates="user", cascade="all, delete-orphan", init=False
    )
    notification_reminders: Mapped[List["NotificationReminder"]] = relationship(
        back_populates="user", cascade="all, delete-orphan", init=False
    )
    subscription_updates: Mapped[List["UserSubscriptionUpdate"]] = relationship(
        back_populates="user", cascade="all, delete-orphan", init=False
    )
    usage_logs: Mapped[List["UserUsageResetLogs"]] = relationship(back_populates="user", init=False)
    admin: Mapped["Admin"] = relationship(back_populates="users", init=False)
    next_plan: Mapped[Optional["NextPlan"]] = relationship(
        uselist=False, back_populates="user", cascade="all, delete-orphan", init=False
    )
    groups: Mapped[List["Group"]] = relationship(secondary=users_groups_association, back_populates="users", init=False)
    proxy_settings: Mapped[Dict[str, Any]] = mapped_column(JSON(True), server_default=text("'{}'"), default=lambda: {})
    status: Mapped[UserStatus] = mapped_column(SQLEnum(UserStatus), default=UserStatus.active)
    used_traffic: Mapped[int] = mapped_column(BigInteger, default=0)
    data_limit: Mapped[Optional[int]] = mapped_column(BigInteger, default=None)
    data_limit_reset_strategy: Mapped[UserDataLimitResetStrategy] = mapped_column(
        SQLEnum(UserDataLimitResetStrategy),
        default=UserDataLimitResetStrategy.no_reset,
    )
    _expire: Mapped[Optional[dt]] = mapped_column("expire", DateTime(timezone=True), default=None, init=False)
    admin_id: Mapped[Optional[int]] = mapped_column(ForeignKey("admins.id"), default=None)
    sub_revoked_at: Mapped[Optional[dt]] = mapped_column(DateTime(timezone=True), default=None)
    note: Mapped[Optional[str]] = mapped_column(String(500), default=None)
    online_at: Mapped[Optional[dt]] = mapped_column(DateTime(timezone=True), default=None)
    on_hold_expire_duration: Mapped[Optional[int]] = mapped_column(BigInteger, default=None)
    on_hold_timeout: Mapped[Optional[dt]] = mapped_column(DateTime(timezone=True), default=None)
    auto_delete_in_days: Mapped[Optional[int]] = mapped_column(default=None)
    edit_at: Mapped[Optional[dt]] = mapped_column(DateTime(timezone=True), default=None)
    last_status_change: Mapped[Optional[dt]] = mapped_column(DateTime(timezone=True), default=None)

    @hybrid_property
    def expire(self) -> Optional[dt]:
        if self._expire and self._expire.tzinfo is None:
            return self._expire.replace(tzinfo=tz.utc)
        return self._expire

    @expire.inplace.expression
    def expire(cls):
        return cls._expire

    @expire.setter
    def expire(self, value: Optional[dt]):
        self._expire = value

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

    @property
    def last_traffic_reset_time(self):
        return self.usage_logs[-1].reset_at if self.usage_logs else self.created_at

    async def inbounds(self) -> list[str]:
        """Returns a flat list of all included inbound tags across all proxies"""
        included_tags = set()
        for group in self.groups:
            if group.is_disabled:
                continue

            await group.awaitable_attrs.inbounds
            for inbound in group.inbound_tags:
                included_tags.add(inbound)
        return list(included_tags)

    @property
    def group_ids(self):
        return [group.id for group in self.groups]

    @property
    def group_names(self):
        return [group.name for group in self.groups]

    @hybrid_property
    def is_expired(self) -> bool:
        return self.expire is not None and self.expire <= dt.now(tz.utc)

    @is_expired.expression
    def is_expired(cls):
        return and_(cls.expire.isnot(None), cls.expire <= func.current_timestamp())

    @hybrid_property
    def is_limited(self) -> bool:
        return self.data_limit is not None and self.data_limit > 0 and self.data_limit <= self.used_traffic

    @is_limited.expression
    def is_limited(cls):
        return and_(cls.data_limit.isnot(None), cls.data_limit > 0, cls.data_limit <= cls.used_traffic)

    @hybrid_property
    def become_online(self) -> bool:
        now = dt.now(tz.utc)

        # Check if online_at is set and greater than or equal to base time
        if self.online_at:
            base_time = (self.edit_at or self.created_at).replace(tzinfo=tz.utc)
            return self.online_at.replace(tzinfo=tz.utc) >= base_time

        # Check if on_hold_timeout has passed
        if self.on_hold_timeout and self.on_hold_timeout.replace(tzinfo=tz.utc) <= now:
            return True

        return False

    @become_online.expression
    def become_online(cls):
        now = func.current_timestamp()
        base_time = case((cls.edit_at.isnot(None), cls.edit_at), else_=cls.created_at)

        return or_(
            # online_at condition
            and_(cls.online_at.isnot(None), cls.online_at >= base_time),
            # on_hold_timeout condition
            and_(cls.online_at.is_(None), cls.on_hold_timeout.isnot(None), cls.on_hold_timeout <= now),
        )

    @hybrid_property
    def usage_percentage(self) -> float:
        if not self.data_limit or self.data_limit == 0:
            return 0.0
        return (self.used_traffic * 100) / self.data_limit

    @usage_percentage.expression
    def usage_percentage(cls):
        return case(
            (and_(cls.data_limit.isnot(None), cls.data_limit > 0), (cls.used_traffic * 100.0) / cls.data_limit),
            else_=0.0,
        )

    @hybrid_property
    def days_left(self) -> int:
        if not self.expire:
            return 0
        remaining_days = (self.expire.replace(tzinfo=tz.utc) - dt.now(tz.utc)).days
        return max(remaining_days, 0)

    @days_left.expression
    def days_left(cls):
        return case((cls.expire.isnot(None), func.floor(DaysDiff())), else_=0)


class UserSubscriptionUpdate(Base):
    __tablename__ = "user_subscription_updates"

    id: Mapped[int] = mapped_column(primary_key=True, init=False)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"))
    user: Mapped["User"] = relationship(back_populates="subscription_updates", init=False)
    created_at: Mapped[dt] = mapped_column(DateTime(timezone=True), default=lambda: dt.now(tz.utc), init=False)
    user_agent: Mapped[str] = mapped_column(String(512))


@event.listens_for(UserSubscriptionUpdate, "after_insert")
def after_insert_user_subscription_update(mapper, connection, target):
    if not USER_SUBSCRIPTION_CLIENTS_LIMIT:
        return

    count = connection.scalar(
        select(func.count()).select_from(UserSubscriptionUpdate).where(UserSubscriptionUpdate.user_id == target.user_id)
    )
    if count > USER_SUBSCRIPTION_CLIENTS_LIMIT:
        oldest_sub_id = connection.scalar(
            select(UserSubscriptionUpdate.id)
            .where(UserSubscriptionUpdate.user_id == target.user_id)
            .order_by(UserSubscriptionUpdate.created_at)
            .limit(1)
        )
        connection.execute(delete(UserSubscriptionUpdate).where(UserSubscriptionUpdate.id == oldest_sub_id))


template_group_association = Table(
    "template_group_association",
    Base.metadata,
    Column("user_template_id", ForeignKey("user_templates.id")),
    Column("group_id", ForeignKey("groups.id")),
)


class NextPlan(Base):
    __tablename__ = "next_plans"

    id: Mapped[int] = mapped_column(primary_key=True, init=False)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"))
    user_template_id: Mapped[Optional[int]] = mapped_column(ForeignKey("user_templates.id"))
    user: Mapped["User"] = relationship(back_populates="next_plan", init=False)
    user_template: Mapped[Optional["UserTemplate"]] = relationship(back_populates="next_plans", init=False)
    data_limit: Mapped[int] = mapped_column(BigInteger, default=0)
    expire: Mapped[Optional[int]] = mapped_column(default=None)
    add_remaining_traffic: Mapped[bool] = mapped_column(default=False, server_default="0")


class UserStatusCreate(str, Enum):
    active = "active"
    on_hold = "on_hold"


class UserTemplate(Base):
    __tablename__ = "user_templates"

    id: Mapped[int] = mapped_column(primary_key=True, init=False)
    name: Mapped[str] = mapped_column(String(64), unique=True)
    username_prefix: Mapped[Optional[str]] = mapped_column(String(20))
    username_suffix: Mapped[Optional[str]] = mapped_column(String(20))
    extra_settings: Mapped[Optional[Dict]] = mapped_column(JSON(True))
    next_plans: Mapped[List["NextPlan"]] = relationship(
        back_populates="user_template", cascade="all, delete-orphan", init=False
    )
    groups: Mapped[List["Group"]] = relationship(secondary=template_group_association, back_populates="templates")
    data_limit: Mapped[int] = mapped_column(BigInteger, default=0)
    expire_duration: Mapped[int] = mapped_column(BigInteger, default=0)  # in seconds
    on_hold_timeout: Mapped[Optional[int]] = mapped_column(default=None)
    status: Mapped[UserStatusCreate] = mapped_column(SQLEnum(UserStatusCreate), default=UserStatusCreate.active)
    reset_usages: Mapped[bool] = mapped_column(default=False, server_default="0")
    data_limit_reset_strategy: Mapped[UserDataLimitResetStrategy] = mapped_column(
        SQLEnum(UserDataLimitResetStrategy),
        default=UserDataLimitResetStrategy.no_reset,
        server_default="no_reset",
    )
    is_disabled: Mapped[bool] = mapped_column(server_default="0", default=False)

    @property
    def group_ids(self):
        return [group.id for group in self.groups]


class UserUsageResetLogs(Base):
    __tablename__ = "user_usage_logs"

    id: Mapped[int] = mapped_column(primary_key=True, init=False)
    user_id: Mapped[Optional[int]] = mapped_column(ForeignKey("users.id"), nullable=True)
    user: Mapped["User"] = relationship(back_populates="usage_logs", init=False)
    used_traffic_at_reset: Mapped[int] = mapped_column(BigInteger, nullable=False)
    reset_at: Mapped[dt] = mapped_column(DateTime(timezone=True), default=lambda: dt.now(tz.utc), init=False)


class ProxyInbound(Base):
    __tablename__ = "inbounds"

    id: Mapped[int] = mapped_column(primary_key=True, init=False)
    tag: Mapped[str] = mapped_column(String(256), unique=True, index=True)
    hosts: Mapped[List["ProxyHost"]] = relationship(back_populates="inbound", init=False)
    groups: Mapped[List["Group"]] = relationship(
        secondary=inbounds_groups_association, back_populates="inbounds", init=False
    )


@event.listens_for(ProxyInbound, "after_delete")
def delete_association_rows(mapper, connection, target):
    connection.execute(
        inbounds_groups_association.delete().where(inbounds_groups_association.c.inbound_id == target.id)
    )


class ProxyHostSecurity(str, Enum):
    inbound_default = "inbound_default"
    none = "none"
    tls = "tls"


ProxyHostALPN = Enum(
    "ProxyHostALPN",
    {
        "none": "",
        "h3": "h3",
        "h2": "h2",
        "http/1.1": "http/1.1",
        "h3,h2,http/1.1": "h3,h2,http/1.1",
        "h3,h2": "h3,h2",
        "h2,http/1.1": "h2,http/1.1",
    },
)
ProxyHostFingerprint = Enum(
    "ProxyHostFingerprint",
    {
        "none": "",
        "chrome": "chrome",
        "firefox": "firefox",
        "safari": "safari",
        "ios": "ios",
        "android": "android",
        "edge": "edge",
        "360": "360",
        "qq": "qq",
        "random": "random",
        "randomized": "randomized",
        "randomizednoalpn": "randomizednoalpn",
        "unsafe": "unsafe",
    },
)


class ProxyHost(Base):
    __tablename__ = "hosts"

    id: Mapped[int] = mapped_column(primary_key=True, init=False)
    remark: Mapped[str] = mapped_column(String(256), unique=False, nullable=False)
    address: Mapped[str] = mapped_column(String(256), unique=False, nullable=False)
    port: Mapped[Optional[int]] = mapped_column(nullable=True)
    path: Mapped[Optional[str]] = mapped_column(String(256), unique=False, nullable=True)
    sni: Mapped[Optional[str]] = mapped_column(String(1000), unique=False, nullable=True)
    host: Mapped[Optional[str]] = mapped_column(String(1000), unique=False, nullable=True)
    inbound_tag: Mapped[Optional[str]] = mapped_column(
        String(256), ForeignKey("inbounds.tag", ondelete="SET NULL", onupdate="CASCADE"), nullable=True, init=False
    )
    inbound: Mapped[Optional["ProxyInbound"]] = relationship(back_populates="hosts", init=False)
    priority: Mapped[int] = mapped_column(nullable=False)
    allowinsecure: Mapped[Optional[bool]] = mapped_column(nullable=True)
    security: Mapped[ProxyHostSecurity] = mapped_column(
        SQLEnum(ProxyHostSecurity),
        unique=False,
        default=ProxyHostSecurity.inbound_default,
    )
    alpn: Mapped[ProxyHostALPN] = mapped_column(
        SQLEnum(ProxyHostALPN),
        unique=False,
        default=ProxyHostSecurity.none,
        server_default=ProxyHostSecurity.none.name,
    )
    fingerprint: Mapped[ProxyHostFingerprint] = mapped_column(
        SQLEnum(ProxyHostFingerprint),
        unique=False,
        default=ProxyHostSecurity.none,
        server_default=ProxyHostSecurity.none.name,
    )
    is_disabled: Mapped[Optional[bool]] = mapped_column(default=False)
    fragment_settings: Mapped[Optional[Dict[str, Any]]] = mapped_column(JSON(none_as_null=True), default=None)
    noise_settings: Mapped[Optional[Dict[str, Any]]] = mapped_column(JSON(none_as_null=True), default=None)
    random_user_agent: Mapped[bool] = mapped_column(default=False, server_default="0")
    use_sni_as_host: Mapped[bool] = mapped_column(default=False, server_default="0")
    http_headers: Mapped[Optional[Dict[str, Any]]] = mapped_column(JSON(none_as_null=True), default=None)
    transport_settings: Mapped[Optional[Dict[str, Any]]] = mapped_column(JSON(none_as_null=True), default=None)
    mux_settings: Mapped[Optional[Dict[str, Any]]] = mapped_column(JSON(none_as_null=True), default=None)
    status: Mapped[Optional[list[UserStatus]]] = mapped_column(
        EnumArray(UserStatus, 60), default=list, server_default=""
    )


class System(Base):
    __tablename__ = "system"

    id: Mapped[int] = mapped_column(primary_key=True, init=False)
    uplink: Mapped[int] = mapped_column(BigInteger, default=0)
    downlink: Mapped[int] = mapped_column(BigInteger, default=0)


class JWT(Base):
    __tablename__ = "jwt"

    id: Mapped[int] = mapped_column(primary_key=True, init=False)
    secret_key: Mapped[str] = mapped_column(String(64), default=lambda: os.urandom(32).hex())


class NodeConnectionType(str, Enum):
    grpc = "grpc"
    rest = "rest"


class NodeStatus(str, Enum):
    connected = "connected"
    connecting = "connecting"
    error = "error"
    disabled = "disabled"


class Node(Base):
    __tablename__ = "nodes"

    id: Mapped[int] = mapped_column(primary_key=True, init=False)
    created_at: Mapped[dt] = mapped_column(DateTime(timezone=True), default=lambda: dt.now(tz.utc), init=False)
    name: Mapped[str] = mapped_column(CaseSensitiveString(256), unique=True)
    address: Mapped[str] = mapped_column(String(256), unique=False, nullable=False)
    port: Mapped[int] = mapped_column(unique=False, nullable=False)
    xray_version: Mapped[Optional[str]] = mapped_column(String(32), nullable=True, init=False)
    message: Mapped[Optional[str]] = mapped_column(String(1024), nullable=True, init=False)
    server_ca: Mapped[str] = mapped_column(String(2048), nullable=False)
    api_key: Mapped[str | None] = mapped_column(String(36))
    node_version: Mapped[Optional[str]] = mapped_column(String(32), nullable=True, init=False)
    core_config_id: Mapped[Optional[int]] = mapped_column(
        ForeignKey("core_configs.id", ondelete="SET NULL"), nullable=True
    )
    user_usages: Mapped[List["NodeUserUsage"]] = relationship(
        back_populates="node", cascade="all, delete-orphan", init=False
    )
    usages: Mapped[List["NodeUsage"]] = relationship(back_populates="node", cascade="all, delete-orphan", init=False)
    core_config: Mapped[Optional["CoreConfig"]] = relationship("CoreConfig", init=False)
    stats: Mapped[List["NodeStat"]] = relationship(back_populates="node", cascade="all, delete-orphan", init=False)
    status: Mapped[NodeStatus] = mapped_column(SQLEnum(NodeStatus), default=NodeStatus.connecting)
    last_status_change: Mapped[Optional[dt]] = mapped_column(DateTime(timezone=True), init=False)
    uplink: Mapped[int] = mapped_column(BigInteger, default=0)
    downlink: Mapped[int] = mapped_column(BigInteger, default=0)
    usage_coefficient: Mapped[float] = mapped_column(Float, server_default=text("1.0"), default=1)
    connection_type: Mapped[NodeConnectionType] = mapped_column(
        SQLEnum(NodeConnectionType),
        unique=False,
        default=NodeConnectionType.grpc,
        server_default=NodeConnectionType.grpc.name,
    )
    keep_alive: Mapped[int] = mapped_column(unique=False, default=0)
    max_logs: Mapped[int] = mapped_column(BigInteger, unique=False, default=1000, server_default=text("1000"))
    gather_logs: Mapped[bool] = mapped_column(default=True, server_default="1")


class NodeUserUsage(Base):
    __tablename__ = "node_user_usages"
    __table_args__ = (UniqueConstraint("created_at", "user_id", "node_id"),)

    id: Mapped[int] = mapped_column(primary_key=True, init=False)
    created_at: Mapped[dt] = mapped_column(DateTime(timezone=True), unique=False)  # one hour per record
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"))
    user: Mapped["User"] = relationship(back_populates="node_usages", init=False)
    node_id: Mapped[Optional[int]] = mapped_column(ForeignKey("nodes.id"))
    node: Mapped["Node"] = relationship(back_populates="user_usages", init=False)
    used_traffic: Mapped[int] = mapped_column(BigInteger, default=0)


class NodeUsage(Base):
    __tablename__ = "node_usages"
    __table_args__ = (UniqueConstraint("created_at", "node_id"),)

    id: Mapped[int] = mapped_column(primary_key=True, init=False)
    created_at: Mapped[dt] = mapped_column(DateTime(timezone=True), unique=False)  # one hour per record
    node_id: Mapped[Optional[int]] = mapped_column(ForeignKey("nodes.id"))
    node: Mapped["Node"] = relationship(back_populates="usages", init=False)
    uplink: Mapped[int] = mapped_column(BigInteger, default=0)
    downlink: Mapped[int] = mapped_column(BigInteger, default=0)


class NotificationReminder(Base):
    __tablename__ = "notification_reminders"

    id: Mapped[int] = mapped_column(primary_key=True, init=False)
    created_at: Mapped[dt] = mapped_column(DateTime(timezone=True), default=lambda: dt.now(tz.utc), init=False)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"))
    user: Mapped["User"] = relationship(back_populates="notification_reminders", init=False)
    type: Mapped[ReminderType] = mapped_column(SQLEnum(ReminderType))
    threshold: Mapped[Optional[int]] = mapped_column(default=None)
    expires_at: Mapped[Optional[dt]] = mapped_column(DateTime(timezone=True), default=None)


class Group(Base):
    __tablename__ = "groups"

    id: Mapped[int] = mapped_column(primary_key=True, init=False)
    name: Mapped[str] = mapped_column(String(64))
    users: Mapped[List["User"]] = relationship(secondary=users_groups_association, back_populates="groups", init=False)
    inbounds: Mapped[List["ProxyInbound"]] = relationship(
        secondary=inbounds_groups_association, back_populates="groups"
    )
    templates: Mapped[List["UserTemplate"]] = relationship(
        secondary=template_group_association, back_populates="groups", init=False
    )
    is_disabled: Mapped[bool] = mapped_column(server_default="0", default=False)

    @property
    def inbound_ids(self):
        return [inbound.id for inbound in self.inbounds]

    @property
    def inbound_tags(self):
        return [inbound.tag for inbound in self.inbounds]

    @property
    def total_users(self):
        return len(self.users)


class CoreConfig(Base):
    __tablename__ = "core_configs"

    id: Mapped[int] = mapped_column(primary_key=True, init=False)
    created_at: Mapped[dt] = mapped_column(DateTime(timezone=True), default=lambda: dt.now(tz.utc), init=False)
    name: Mapped[str] = mapped_column(String(256))
    config: Mapped[Dict[str, Any]] = mapped_column(JSON(False))
    exclude_inbound_tags: Mapped[Optional[str]] = mapped_column(String(2048))
    fallbacks_inbound_tags: Mapped[Optional[str]] = mapped_column(String(2048))


class NodeStat(Base):
    __tablename__ = "node_stats"

    id: Mapped[int] = mapped_column(primary_key=True, init=False)
    created_at: Mapped[dt] = mapped_column(DateTime(timezone=True), default=lambda: dt.now(tz.utc), init=False)
    node_id: Mapped[int] = mapped_column(ForeignKey("nodes.id"))
    node: Mapped["Node"] = relationship(back_populates="stats", init=False)
    mem_total: Mapped[int] = mapped_column(BigInteger, unique=False, nullable=False)
    mem_used: Mapped[int] = mapped_column(BigInteger, unique=False, nullable=False)
    cpu_cores: Mapped[int] = mapped_column(unique=False, nullable=False)
    cpu_usage: Mapped[float] = mapped_column(unique=False, nullable=False)
    incoming_bandwidth_speed: Mapped[int] = mapped_column(BigInteger, unique=False, nullable=False)
    outgoing_bandwidth_speed: Mapped[int] = mapped_column(BigInteger, unique=False, nullable=False)


class Settings(Base):
    __tablename__ = "settings"

    id: Mapped[int] = mapped_column(primary_key=True, init=False)
    telegram: Mapped[dict] = mapped_column(JSON())
    discord: Mapped[dict] = mapped_column(JSON())
    webhook: Mapped[dict] = mapped_column(JSON())
    notification_settings: Mapped[dict] = mapped_column(JSON())
    notification_enable: Mapped[dict] = mapped_column(JSON())
    subscription: Mapped[dict] = mapped_column(JSON())
    general: Mapped[dict] = mapped_column(JSON())

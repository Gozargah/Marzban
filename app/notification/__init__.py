import asyncio

from . import discord as ds
from . import telegram as tg
from . import webhook as wh
from app.models.host import BaseHost
from app.models.user_template import UserTemplateResponse
from app.models.node import NodeResponse
from app.models.group import GroupResponse
from app.models.core import CoreResponse
from app.models.admin import AdminDetails
from app.models.user import UserNotificationResponse
from app.db import AsyncSession
from app.db.models import ReminderType
from app.db.crud.user import create_notification_reminder
from app.settings import notification_enable


async def create_host(host: BaseHost, by: str):
    if (await notification_enable()).host:
        await asyncio.gather(ds.create_host(host, by), tg.create_host(host, by))


async def modify_host(host: BaseHost, by: str):
    if (await notification_enable()).host:
        await asyncio.gather(ds.modify_host(host, by), tg.modify_host(host, by))


async def remove_host(host: BaseHost, by: str):
    if (await notification_enable()).host:
        await asyncio.gather(ds.remove_host(host, by), tg.remove_host(host, by))


async def modify_hosts(by: str):
    if (await notification_enable()).host:
        await asyncio.gather(ds.modify_hosts(by), tg.modify_hosts(by))


async def create_user_template(user: UserTemplateResponse, by: str):
    if (await notification_enable()).user_template:
        await asyncio.gather(ds.create_user_template(user, by), tg.create_user_template(user, by))


async def modify_user_template(user: UserTemplateResponse, by: str):
    if (await notification_enable()).user_template:
        await asyncio.gather(ds.modify_user_template(user, by), tg.modify_user_template(user, by))


async def remove_user_template(name: str, by: str):
    if (await notification_enable()).user_template:
        await asyncio.gather(ds.remove_user_template(name, by), tg.remove_user_template(name, by))


async def create_node(node: NodeResponse, by: str):
    if (await notification_enable()).node:
        await asyncio.gather(ds.create_node(node, by), tg.create_node(node, by))


async def modify_node(node: NodeResponse, by: str):
    if (await notification_enable()).node:
        await asyncio.gather(ds.modify_node(node, by), tg.modify_node(node, by))


async def remove_node(node: NodeResponse, by: str):
    if (await notification_enable()).node:
        await asyncio.gather(ds.remove_node(node, by), tg.remove_node(node, by))


async def connect_node(node: NodeResponse):
    if (await notification_enable()).node:
        await asyncio.gather(ds.connect_node(node), tg.connect_node(node))


async def error_node(node: NodeResponse):
    if (await notification_enable()).node:
        await asyncio.gather(ds.error_node(node), tg.error_node(node))


async def create_group(group: GroupResponse, by: str):
    if (await notification_enable()).group:
        await asyncio.gather(ds.create_group(group, by), tg.create_group(group, by))


async def modify_group(group: GroupResponse, by: str):
    if (await notification_enable()).group:
        await asyncio.gather(ds.modify_group(group, by), tg.modify_group(group, by))


async def remove_group(group_id: int, by: str):
    if (await notification_enable()).group:
        await asyncio.gather(ds.remove_group(group_id, by), tg.remove_group(group_id, by))


async def create_admin(admin: AdminDetails, by: str):
    if (await notification_enable()).admin:
        await asyncio.gather(ds.create_admin(admin, by), tg.create_admin(admin, by))


async def modify_admin(admin: AdminDetails, by: str):
    if (await notification_enable()).admin:
        await asyncio.gather(ds.modify_admin(admin, by), tg.modify_admin(admin, by))


async def remove_admin(username: str, by: str):
    if (await notification_enable()).admin:
        await asyncio.gather(ds.remove_admin(username, by), tg.remove_admin(username, by))


async def admin_usage_reset(admin: AdminDetails, by: str):
    if (await notification_enable()).admin:
        await asyncio.gather(ds.admin_reset_usage(admin, by), tg.admin_reset_usage(admin, by))


async def admin_login(username: str, password: str, client_ip: str, success: bool):
    if (await notification_enable()).login:
        await asyncio.gather(
            ds.admin_login(username, password, client_ip, success),
            tg.admin_login(username, password, client_ip, success),
        )


async def user_status_change(user: UserNotificationResponse, by: AdminDetails):
    if (await notification_enable()).user:
        await asyncio.gather(
            ds.user_status_change(user, by.username), tg.user_status_change(user, by.username), wh.status_change(user)
        )


async def create_user(user: UserNotificationResponse, by: AdminDetails):
    if (await notification_enable()).user:
        await asyncio.gather(
            ds.create_user(user, by.username),
            tg.create_user(user, by.username),
            wh.notify(wh.UserCreated(username=user.username, user=user, by=by)),
        )


async def modify_user(user: UserNotificationResponse, by: AdminDetails):
    if (await notification_enable()).user:
        await asyncio.gather(
            ds.modify_user(user, by.username),
            tg.modify_user(user, by.username),
            wh.notify(wh.UserUpdated(username=user.username, user=user, by=by)),
        )


async def remove_user(user: UserNotificationResponse, by: AdminDetails):
    if (await notification_enable()).user:
        await asyncio.gather(
            ds.remove_user(user, by.username),
            tg.remove_user(user, by.username),
            wh.notify(wh.UserDeleted(username=user.username, user=user, by=by)),
        )


async def reset_user_data_usage(user: UserNotificationResponse, by: AdminDetails):
    if (await notification_enable()).user:
        await asyncio.gather(
            ds.reset_user_data_usage(user, by.username),
            tg.reset_user_data_usage(user, by.username),
            wh.notify(wh.UserDataUsageReset(username=user.username, user=user, by=by)),
        )


async def user_data_reset_by_next(user: UserNotificationResponse, by: AdminDetails):
    if (await notification_enable()).user:
        await asyncio.gather(
            ds.user_data_reset_by_next(user, by.username),
            tg.user_data_reset_by_next(user, by.username),
            wh.notify(wh.UserDataResetByNext(username=user.username, user=user, by=by)),
        )


async def user_subscription_revoked(user: UserNotificationResponse, by: AdminDetails):
    if (await notification_enable()).user:
        await asyncio.gather(
            ds.user_subscription_revoked(user, by.username),
            tg.user_subscription_revoked(user, by.username),
            wh.notify(wh.UserSubscriptionRevoked(username=user.username, user=user, by=by)),
        )


async def data_usage_percent_reached(
    db: AsyncSession, percent: float, user: UserNotificationResponse, threshold: int
) -> None:
    if (await notification_enable()).percentage_reached:
        await asyncio.gather(
            wh.notify(wh.ReachedUsagePercent(username=user.username, user=user, used_percent=percent)),
            create_notification_reminder(
                db,
                ReminderType.data_usage,
                expires_at=user.expire if user.expire else None,
                user_id=user.id,
                threshold=threshold,
            ),
        )


async def expire_days_reached(db: AsyncSession, days: int, user: UserNotificationResponse, threshold: int) -> None:
    if (await notification_enable()).days_left:
        await asyncio.gather(
            wh.notify(wh.ReachedDaysLeft(username=user.username, user=user, days_left=days)),
            create_notification_reminder(
                db, ReminderType.expiration_date, expires_at=user.expire, user_id=user.id, threshold=threshold
            ),
        )


async def create_core(core: CoreResponse, by: str):
    if (await notification_enable()).core:
        await asyncio.gather(ds.create_core(core, by), tg.create_core(core, by))


async def modify_core(core: CoreResponse, by: str):
    if (await notification_enable()).core:
        await asyncio.gather(ds.modify_core(core, by), tg.modify_core(core, by))


async def remove_core(core_id: int, by: str):
    if (await notification_enable()).core:
        await asyncio.gather(ds.remove_core(core_id, by), tg.remove_core(core_id, by))

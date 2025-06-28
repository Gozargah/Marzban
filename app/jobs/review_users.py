import asyncio
from datetime import datetime as dt, timezone as tz, timedelta as td

from sqlalchemy.ext.asyncio import AsyncSession

from app import notification, scheduler
from app.db import GetDB
from app.db.crud.user import (
    get_active_to_expire_users,
    get_active_to_limited_users,
    get_days_left_reached_users,
    get_on_hold_to_active_users,
    get_usage_percentage_reached_users,
    reset_user_by_next,
    start_users_expire,
    update_users_status,
)
from app.db.models import User, UserStatus
from app.jobs.dependencies import SYSTEM_ADMIN
from app.models.settings import Webhook
from app.models.user import UserNotificationResponse
from app.node import node_manager as node_manager
from app.settings import webhook_settings
from app.utils.logger import get_logger
from config import JOB_REVIEW_USERS_INTERVAL

logger = get_logger("review-users")


async def reset_user_by_next_report(db: AsyncSession, db_user: User):
    db_user = await reset_user_by_next(db, db_user)
    user = UserNotificationResponse.model_validate(db_user)

    asyncio.create_task(node_manager.update_user(user))
    asyncio.create_task(notification.user_data_reset_by_next(user, SYSTEM_ADMIN))

    logger.info(f'User "{db_user.username}" next plan activated')


async def change_status(db: AsyncSession, db_user: User, status: UserStatus):
    user = UserNotificationResponse.model_validate(db_user)
    if user.status is not UserStatus.active:
        asyncio.create_task(node_manager.remove_user(user))
    asyncio.create_task(notification.user_status_change(user, SYSTEM_ADMIN))

    logger.info(f'User "{db_user.username}" status changed to {status.value}')

    if db_user.next_plan and db_user.status is not UserStatus.active:
        await reset_user_by_next_report(db, db_user)


async def expire_users_job():
    async with GetDB() as db:
        if expired_users := await get_active_to_expire_users(db):
            updated_users = await update_users_status(db, expired_users, UserStatus.expired)
            for user in updated_users:
                await change_status(db, user, UserStatus.expired)


async def limit_users_job():
    async with GetDB() as db:
        if limited_users := await get_active_to_limited_users(db):
            updated_users = await update_users_status(db, limited_users, UserStatus.limited)
            for user in updated_users:
                await change_status(db, user, UserStatus.limited)


async def on_hold_to_active_users_job():
    async with GetDB() as db:
        if on_hold_users := await get_on_hold_to_active_users(db):
            updated_users = await start_users_expire(db, on_hold_users)
            for user in updated_users:
                await change_status(db, user, UserStatus.active)


async def usage_percent_notification_job():
    settings: Webhook = await webhook_settings()
    if not settings.enable:
        return
    async with GetDB() as db:
        for percent in settings.usage_percent:
            users = await get_usage_percentage_reached_users(db, percent)
            for user in users:
                await notification.data_usage_percent_reached(
                    db, user.usage_percentage, UserNotificationResponse.model_validate(user), percent
                )


async def days_left_notification_job():
    settings: Webhook = await webhook_settings()
    if not settings.enable:
        return
    async with GetDB() as db:
        for days in settings.days_left:
            users = await get_days_left_reached_users(db, days)
            for user in users:
                await notification.expire_days_reached(
                    db, user.days_left, UserNotificationResponse.model_validate(user), days
                )


now = dt.now(tz.utc) + td(seconds=2)

# Register each job separately
scheduler.add_job(
    expire_users_job, "interval", seconds=JOB_REVIEW_USERS_INTERVAL, coalesce=True, max_instances=1, start_date=now
)
scheduler.add_job(
    limit_users_job,
    "interval",
    seconds=JOB_REVIEW_USERS_INTERVAL,
    coalesce=True,
    max_instances=1,
    start_date=now + td(seconds=6),
)
scheduler.add_job(
    on_hold_to_active_users_job,
    "interval",
    seconds=JOB_REVIEW_USERS_INTERVAL,
    coalesce=True,
    max_instances=1,
    start_date=now + td(seconds=12),
)
scheduler.add_job(
    usage_percent_notification_job,
    "interval",
    seconds=JOB_REVIEW_USERS_INTERVAL,
    coalesce=True,
    max_instances=1,
    start_date=now + td(seconds=18),
)
scheduler.add_job(
    days_left_notification_job,
    "interval",
    seconds=JOB_REVIEW_USERS_INTERVAL,
    coalesce=True,
    max_instances=1,
    start_date=now + td(seconds=24),
)

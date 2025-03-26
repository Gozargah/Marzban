from datetime import datetime, timezone
import asyncio

from sqlalchemy.orm import Session

from app import async_scheduler as scheduler
from app.db import GetDB
from app.db.crud import (
    get_notification_reminder,
    get_users,
    reset_user_by_next,
    start_user_expire,
    update_user_status,
)
from app.db.models import User, ReminderType, UserStatus
from app.node import node_manager as node_manager
from app.models.user import UserResponse
from app.utils.logger import get_logger
from app.utils import report
from app.utils.helpers import calculate_expiration_days, calculate_usage_percent
from app import notification
from app.jobs.dependencies import SYSTEM_ADMIN
from config import (
    JOB_REVIEW_USERS_INTERVAL,
    NOTIFY_DAYS_LEFT,
    NOTIFY_REACHED_USAGE_PERCENT,
    WEBHOOK_ADDRESS,
)


logger = get_logger("review-users")


async def add_notification_reminders(db: Session, user: User) -> None:
    if user.data_limit:
        usage_percent = calculate_usage_percent(user.used_traffic, user.data_limit)

        for percent in sorted(NOTIFY_REACHED_USAGE_PERCENT, reverse=True):
            if usage_percent >= percent:
                if not await get_notification_reminder(db, user.id, ReminderType.data_usage, threshold=percent):
                    report.data_usage_percent_reached(
                        db, usage_percent, UserResponse.model_validate(user), user.id, user.expire, threshold=percent
                    )
                break

    if user.expire:
        expire_days = calculate_expiration_days(user.expire)

        for days_left in sorted(NOTIFY_DAYS_LEFT):
            if expire_days <= days_left:
                if not await get_notification_reminder(db, user.id, ReminderType.expiration_date, threshold=days_left):
                    report.expire_days_reached(
                        db, expire_days, UserResponse.model_validate(user), user.id, user.expire, threshold=days_left
                    )
                break


async def reset_user_by_next_report(db: Session, db_user: User):
    db_user = await reset_user_by_next(db, db_user)

    user = UserResponse.model_validate(db_user)

    asyncio.create_task(node_manager.update_user(user))

    asyncio.create_task(notification.user_data_reset_by_next(user, user.admin))


async def review():
    now = datetime.now(timezone.utc)
    async with GetDB() as db:
        for db_user in await get_users(db, status=UserStatus.active):
            limited = db_user.data_limit and db_user.used_traffic >= db_user.data_limit
            expired = db_user.expire and db_user.expire.replace(tzinfo=timezone.utc) <= now

            if (limited or expired) and db_user.next_plan is not None:
                if db_user.next_plan is not None:
                    if db_user.next_plan.fire_on_either:
                        await reset_user_by_next_report(db, db_user)
                        continue

                    elif limited and expired:
                        await reset_user_by_next_report(db, db_user)
                        continue

            if limited:
                status = UserStatus.limited
            elif expired:
                status = UserStatus.expired
            else:
                if WEBHOOK_ADDRESS:
                    await add_notification_reminders(db, db_user)
                continue

            await update_user_status(db, db_user, status)

            user = UserResponse.model_validate(db_user)
            asyncio.create_task(node_manager.update_user(user))

            asyncio.create_task(notification.user_status_change(user, SYSTEM_ADMIN))

            logger.info(f'User "{db_user.username}" status changed to {status.value}')

        for db_user in await get_users(db, status=UserStatus.on_hold):
            if db_user.edit_at:
                base_time = db_user.edit_at
            else:
                base_time = db_user.created_at

            # Check if the user is online After or at 'base_time'
            if db_user.online_at and base_time <= db_user.online_at:
                status = UserStatus.active

            elif db_user.on_hold_timeout and (db_user.on_hold_timeout <= now):
                # If the user didn't connect within the timeout period, change status to "Active"
                status = UserStatus.active

            else:
                continue

            await update_user_status(db, db_user, status)
            await start_user_expire(db, db_user)
            user = UserResponse.model_validate(db_user)

            asyncio.create_task(notification.user_status_change(user, SYSTEM_ADMIN))

            logger.info(f'User "{db_user.username}" status changed to {status.value}')


scheduler.add_job(review, "interval", seconds=JOB_REVIEW_USERS_INTERVAL, coalesce=True, max_instances=1)

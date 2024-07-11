from datetime import datetime
from typing import TYPE_CHECKING

from sqlalchemy.orm import Session

from app import logger, scheduler, xray
from app.db import (GetDB, get_notification_reminder, get_users,
                    start_user_expire, update_user_status)
from app.models.user import ReminderType, UserResponse, UserStatus
from app.utils import report
from app.utils.concurrency import GetBG
from app.utils.helpers import (calculate_expiration_days,
                               calculate_usage_percent)
from config import (NOTIFY_DAYS_LEFT, NOTIFY_REACHED_USAGE_PERCENT,
                    WEBHOOK_ADDRESS)

if TYPE_CHECKING:
    from app.db.models import User


def add_notification_reminders(db: Session, user: "User", now: datetime = datetime.utcnow()) -> None:
    if user.data_limit:
        usage_percent = calculate_usage_percent(
            user.used_traffic, user.data_limit)
        if (usage_percent >= NOTIFY_REACHED_USAGE_PERCENT) and (not get_notification_reminder(db, user.id, ReminderType.data_usage)):
            report.data_usage_percent_reached(
                db, usage_percent, UserResponse.from_orm(user),
                user.id, user.expire)

    if user.expire and ((now - user.created_at).days >= NOTIFY_DAYS_LEFT):
        expire_days = calculate_expiration_days(user.expire)
        if (expire_days <= NOTIFY_DAYS_LEFT) and (not get_notification_reminder(db, user.id, ReminderType.expiration_date)):
            report.expire_days_reached(
                db, expire_days, UserResponse.from_orm(user),
                user.id, user.expire)


def review():
    now = datetime.utcnow()
    now_ts = now.timestamp()
    with GetDB() as db, GetBG() as bg:
        for user in get_users(db, status=UserStatus.active):

            limited = user.data_limit and user.used_traffic >= user.data_limit
            expired = user.expire and user.expire <= now_ts
            if limited:
                status = UserStatus.limited
            elif expired:
                status = UserStatus.expired
            else:
                if WEBHOOK_ADDRESS:
                    add_notification_reminders(db, user, now)
                continue

            xray.operations.remove_user(user)
            update_user_status(db, user, status)

            report.status_change(username=user.username, status=status,
                user=UserResponse.from_orm(user), user_admin=user.admin)

            logger.info(f"User \"{user.username}\" status changed to {status}")

        for user in get_users(db, status=UserStatus.on_hold):

            if user.edit_at:
                base_time = datetime.timestamp(user.edit_at)
            else:
                base_time = datetime.timestamp(user.created_at)

            # Check if the user is online After or at 'base_time'
            if user.online_at and base_time <= datetime.timestamp(user.online_at):
                status = UserStatus.active

            elif user.on_hold_timeout and (datetime.timestamp(user.on_hold_timeout) <= (now_ts)):
                # If the user didn't connect within the timeout period, change status to "Active"
                status = UserStatus.active

            else:
                continue

            update_user_status(db, user, status)
            start_user_expire(db, user)
            
            report.status_change(username=user.username, status=status,
                user=UserResponse.from_orm(user), user_admin=user.admin)

            logger.info(f"User \"{user.username}\" status changed to {status}")


scheduler.add_job(review, 'interval', seconds=10, coalesce=True, max_instances=1)

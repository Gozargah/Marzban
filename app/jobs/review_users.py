from datetime import datetime
from typing import TYPE_CHECKING

from sqlalchemy.orm import Session

from app import logger, scheduler, xray
from app.db import (GetDB, get_notification_reminder, get_users,
                    update_user_status, record_user_log)
from app.models.user import ReminderType, UserResponse, UserStatus, Action
from app.utils import report
from app.utils.helpers import (calculate_expiration_days,
                               calculate_usage_percent)
from config import (NOTIFY_DAYS_LEFT, NOTIFY_REACHED_USAGE_PERCENT,
                    WEBHOOK_ADDRESS)

if TYPE_CHECKING:
    from app.db.models import User


def add_notification_reminders(db: Session, user: "User", now: datetime = datetime.utcnow()) -> None:
    if user.data_limit:
        usage_percent = calculate_usage_percent(user.used_traffic, user.data_limit)
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
    with GetDB() as db:
        for user in get_users(db, status=UserStatus.active):

            limited = user.data_limit and user.used_traffic >= user.data_limit
            expired = user.expire and user.expire <= now.timestamp()
            if limited:
                status = UserStatus.limited
            elif expired:
                status = UserStatus.expired
            else:
                if WEBHOOK_ADDRESS:
                    add_notification_reminders(db, user, now)
                continue

            xray.operations.remove_user(user)
            dbuser = update_user_status(db, user, status)
            report.status_change(user.username, status, UserResponse.from_orm(user))
            
            record_user_log(db=db, action=Action.status_change, dbuser=dbuser,
                                old_status=UserStatus.active, used_traffic=dbuser.used_traffic)

            logger.info(f"User \"{user.username}\" status changed to {status}")


scheduler.add_job(review, 'interval', seconds=5)

import itertools
from datetime import datetime

from app import logger, scheduler, xray
from app.db import (GetDB, get_notification_reminder, get_users,
                    update_user_status)
from app.models.user import ReminderType, UserResponse, UserStatus
from app.utils import report
from app.utils.helpers import (calculate_expiration_days,
                               calculate_usage_percent)
from config import NOTIFY_DAYS_LEFT, NOTIFY_REACHED_USAGE_PERCENT, WEBHOOK_ADDRESS


def review():
    now = datetime.utcnow().timestamp()
    with GetDB() as db:
        for user in get_users(db, status=UserStatus.active):

            limited = user.data_limit and user.used_traffic >= user.data_limit
            expired = user.expire and user.expire <= now
            if limited:
                status = UserStatus.limited
            elif expired:
                status = UserStatus.expired
            else:
                if WEBHOOK_ADDRESS:
                    if user.data_limit and (
                            usage_percent := calculate_usage_percent(user.used_traffic, user.data_limit)) >= NOTIFY_REACHED_USAGE_PERCENT:
                        if not get_notification_reminder(db, user.id, ReminderType.data_usage):
                            report.data_usage_percent_reached(
                                db, usage_percent, UserResponse.from_orm(user),
                                user.id, user.expire)
                    if user.expire and (expire_days := calculate_expiration_days(user.expire)) <= NOTIFY_DAYS_LEFT:
                        if not get_notification_reminder(db, user.id, ReminderType.expiration_date):
                            report.expire_days_reached(
                                db, expire_days, UserResponse.from_orm(user),
                                user.id, user.expire)
                continue

            xray.operations.remove_user(user)
            update_user_status(db, user, status)

            report.status_change(user.username, status, UserResponse.from_orm(user))

            logger.info(f"User \"{user.username}\" status changed to {status}")


scheduler.add_job(review, 'interval', seconds=5)

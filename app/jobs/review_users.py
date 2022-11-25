from datetime import datetime

from app import logger, scheduler, xray
from app.db import get_users, get_db, update_user_status
from app.models.user import UserStatus
from app.xray import INBOUND_TAGS


def review():
    now = datetime.utcnow().timestamp()
    for db in get_db():
        for user in get_users(db, status=UserStatus.active):
            limited = user.data_limit and user.used_traffic >= user.data_limit
            expired = user.expire and user.expire <= now
            if limited:
                status = UserStatus.limited
            elif expired:
                status = UserStatus.expired
            else:
                continue

            update_user_status(db, user, status)
            inbound = INBOUND_TAGS[user.proxy_type]
            try:
                xray.api.remove_inbound_user(tag=inbound, email=user.username)
            except xray.exc.EmailNotFoundError:
                pass
            logger.info(f"User \"{user.username}\" status changed to {status}")


scheduler.add_job(review, 'interval', seconds=10)

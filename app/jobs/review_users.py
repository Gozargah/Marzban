import itertools
from datetime import datetime

from app import logger, scheduler, telegram, xray
from app.db import GetDB, get_users, update_user_status
from app.models.user import UserStatus


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
                continue

            inbound_tags = itertools.chain.from_iterable(user.inbounds.values())
            for inbound_tag in inbound_tags:
                try:
                    xray.api.remove_inbound_user(tag=inbound_tag, email=user.username)
                except xray.exc.EmailNotFoundError:
                    pass

                except xray.exceptions.ConnectionError:
                    try:
                        xray.core.restart()
                    except ProcessLookupError:
                        pass

                    return  # stop reviewing temporarily

            update_user_status(db, user, status)

            try:
                telegram.report_status_change(user.username, status)
            except Exception:
                pass

            logger.info(f"User \"{user.username}\" status changed to {status}")


scheduler.add_job(review, 'interval', seconds=5)

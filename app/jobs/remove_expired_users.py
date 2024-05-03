import logging
from app import scheduler
from app.db import GetDB, crud
from config import USER_AUTODELETE_INCLUDE_LIMITED_ACCOUNTS

logger = logging.getLogger(__name__)


# TODO: Send notifications
def remove_expired_users():
    with GetDB() as db:
        deleted_users = crud.delete_all_expired_users(db, USER_AUTODELETE_INCLUDE_LIMITED_ACCOUNTS)

        for user in deleted_users:
            # TODO: Send notifications
            logger.log(logging.INFO, "Expired user %s deleted." % user.username)


scheduler.add_job(remove_expired_users, 'interval', coalesce=True, hours=6, max_instances=1)

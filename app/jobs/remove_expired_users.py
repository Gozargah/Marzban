import logging
from app import scheduler
from app.db import GetDB, crud
from app.models.admin import Admin
from config import USER_AUTODELETE_INCLUDE_LIMITED_ACCOUNTS
from app.utils import report
from app.jobs.utils import SYSTEM_ADMIN

logger = logging.getLogger(__name__)


def remove_expired_users():
    with GetDB() as db:
        deleted_users = crud.delete_all_expired_users(db, USER_AUTODELETE_INCLUDE_LIMITED_ACCOUNTS)

        for user in deleted_users:
            report.user_deleted(user.username, SYSTEM_ADMIN, user_admin=Admin.from_orm(user.admin))
            logger.log(logging.INFO, "Expired user %s deleted." % user.username)


scheduler.add_job(remove_expired_users, 'interval', coalesce=True, hours=6, max_instances=1)

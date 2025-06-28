import asyncio

from app import scheduler
from app.db import GetDB
from app.db.crud.user import autodelete_expired_users
from app.models.user import UserNotificationResponse
from app import notification
from app.jobs.dependencies import SYSTEM_ADMIN
from app.utils.logger import get_logger
from config import USER_AUTODELETE_INCLUDE_LIMITED_ACCOUNTS, JOB_REMOVE_EXPIRED_USERS_INTERVAL


logger = get_logger("jobs")


async def remove_expired_users():
    async with GetDB() as db:
        deleted_users = await autodelete_expired_users(db, USER_AUTODELETE_INCLUDE_LIMITED_ACCOUNTS)

        for user in deleted_users:
            asyncio.create_task(
                notification.remove_user(user=UserNotificationResponse.model_validate(user), by=SYSTEM_ADMIN)
            )
            logger.info("Expired user %s deleted.", user.username)


scheduler.add_job(
    remove_expired_users, "interval", coalesce=True, seconds=JOB_REMOVE_EXPIRED_USERS_INTERVAL, max_instances=1
)

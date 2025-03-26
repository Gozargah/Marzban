import asyncio

from app import logger, async_scheduler as scheduler
from app.db import GetDB
from app.db.crud import autodelete_expired_users
from app.models.user import UserResponse
from app import notification
from config import USER_AUTODELETE_INCLUDE_LIMITED_ACCOUNTS
from app.jobs.dependencies import SYSTEM_ADMIN


async def remove_expired_users():
    async with GetDB() as db:
        deleted_users = await autodelete_expired_users(db, USER_AUTODELETE_INCLUDE_LIMITED_ACCOUNTS)

        for user in deleted_users:
            asyncio.create_task(notification.remove_user(user=UserResponse.model_validate(user), by=SYSTEM_ADMIN))
            logger.info("Expired user %s deleted.", user.username)


scheduler.add_job(remove_expired_users, "interval", coalesce=True, hours=6, max_instances=1)

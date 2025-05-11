import asyncio

from sqlalchemy.orm import Session

from app import scheduler
from app.db import GetDB
from app.db.crud import (
    reset_user_by_next,
    start_users_expire,
    update_users_status,
    get_active_to_expire_users,
    get_active_to_limited_users,
    get_on_hold_to_active_users,
    get_usage_percentage_reached_users,
    get_days_left_reached_users,
)
from app.db.models import User, UserStatus
from app.node import node_manager as node_manager
from app.models.user import UserResponse
from app.models.settings import Webhook
from app.settings import webhook_settings
from app.utils.logger import get_logger
from app import notification
from app.jobs.dependencies import SYSTEM_ADMIN
from config import JOB_REVIEW_USERS_INTERVAL


logger = get_logger("review-users")


async def reset_user_by_next_report(db: Session, db_user: User):
    db_user = await reset_user_by_next(db, db_user)

    user = UserResponse.model_validate(db_user)

    asyncio.create_task(node_manager.update_user(user))

    asyncio.create_task(notification.user_data_reset_by_next(user, SYSTEM_ADMIN))


async def review():
    async with GetDB() as db:

        async def change_status(db_user: User, status: UserStatus):
            user = UserResponse.model_validate(db_user)

            if user.status is not UserStatus.active:
                asyncio.create_task(node_manager.remove_user(user))

            asyncio.create_task(notification.user_status_change(user, SYSTEM_ADMIN))

            logger.info(f'User "{db_user.username}" status changed to {status.value}')

            if db_user.next_plan and (db_user.next_plan.fire_on_either or (db_user.is_limited and db_user.is_expired)):
                await reset_user_by_next_report(db, db_user)

        if expired_users := await get_active_to_expire_users(db):
            updated_users = await update_users_status(db, expired_users, UserStatus.expired)
            for user in updated_users:
                await change_status(user, UserStatus.expired)

        if limited_users := await get_active_to_limited_users(db):
            updated_users = await update_users_status(db, limited_users, UserStatus.limited)
            for user in updated_users:
                await change_status(user, UserStatus.limited)

        users = await get_on_hold_to_active_users(db)
        if on_hold_users := await get_on_hold_to_active_users(db):
            updated_users = await start_users_expire(db, on_hold_users)

            for user in updated_users:
                await change_status(user, UserStatus.active)

        settings: Webhook = await webhook_settings()
        if settings.enable:
            for percent in settings.usage_percent:
                users = await get_usage_percentage_reached_users(db, percent)
                for user in users:
                    await notification.data_usage_percent_reached(
                        db, user.usage_percentage, UserResponse.model_validate(user), percent
                    )

            for days in settings.days_left:
                users = await get_days_left_reached_users(db, days)
                for user in users:
                    await notification.expire_days_reached(db, user.days_left, UserResponse.model_validate(user), days)


scheduler.add_job(review, "interval", seconds=JOB_REVIEW_USERS_INTERVAL, coalesce=True, max_instances=1)

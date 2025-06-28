import asyncio
from datetime import datetime as dt, timedelta as td, timezone as tz

from app import scheduler
from app.db import GetDB
from app.db.models import UserStatus, UserDataLimitResetStrategy, User
from app.db.crud.user import reset_user_data_usage, get_users
from app.models.user import UserNotificationResponse
from app import notification
from app.core.manager import core_manager
from app.node import node_manager
from app.jobs.dependencies import SYSTEM_ADMIN
from app.utils.logger import get_logger
from config import JOB_RESET_USER_DATA_USAGE_INTERVAL

reset_strategy_to_days = {
    UserDataLimitResetStrategy.day.value: 1,
    UserDataLimitResetStrategy.week.value: 7,
    UserDataLimitResetStrategy.month.value: 30,
    UserDataLimitResetStrategy.year.value: 365,
}

logger = get_logger("jobs")


async def reset_data_usage():
    now = dt.now(tz.utc)
    async with GetDB() as db:

        async def check_user(db_user: User):
            last_reset_time = db_user.last_traffic_reset_time
            num_days_to_reset = reset_strategy_to_days[db_user.data_limit_reset_strategy]

            if not (now - last_reset_time.replace(tzinfo=tz.utc)).days >= num_days_to_reset:
                return

            old_status = db_user.status

            db_user = await reset_user_data_usage(db, db_user)
            user = UserNotificationResponse.model_validate(db_user)
            asyncio.create_task(notification.reset_user_data_usage(user, SYSTEM_ADMIN))

            if old_status != db_user.status:
                asyncio.create_task(notification.user_status_change(user, SYSTEM_ADMIN))

            # make user active if limited on usage reset
            if user.status == UserStatus.active:
                asyncio.create_task(node_manager.update_user(user=user, inbounds=await core_manager.get_inbounds()))

            logger.info(f'User data usage reset for User "{user.username}"')

        users = await get_users(
            db,
            status=[UserStatus.active, UserStatus.limited],
            reset_strategy=[
                UserDataLimitResetStrategy.day.value,
                UserDataLimitResetStrategy.week.value,
                UserDataLimitResetStrategy.month.value,
                UserDataLimitResetStrategy.year.value,
            ],
        )
        for user in users:
            await check_user(user)


scheduler.add_job(
    reset_data_usage,
    "interval",
    seconds=JOB_RESET_USER_DATA_USAGE_INTERVAL,
    coalesce=True,
    start_date=dt.now(tz.utc) + td(minutes=1),
    max_instances=1,
)

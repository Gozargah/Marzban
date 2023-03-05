from datetime import datetime

from app import logger, scheduler
from app.db import crud, get_db, get_users
from app.models.user import UserDataLimitResetStrategy, UserStatus
from app.utils.xray import xray_add_user


reset_strategy_to_days = {
    UserDataLimitResetStrategy.day.value: 1,
    UserDataLimitResetStrategy.week.value: 7,
    UserDataLimitResetStrategy.month.value: 30,
    UserDataLimitResetStrategy.year.value: 365,
}


def reset_user_data_usage():
    now = datetime.utcnow()
    db = next(get_db())
    for user in get_users(db, reset_strategy=[
        UserDataLimitResetStrategy.day.value,
        UserDataLimitResetStrategy.week.value,
        UserDataLimitResetStrategy.month.value,
        UserDataLimitResetStrategy.year.value,
    ]):
        last_reset_time = user.last_traffic_reset_time
        num_days_to_reset = reset_strategy_to_days[user.data_limit_reset_strategy]

        if not (now - last_reset_time).days >= num_days_to_reset:
            continue

        crud.reset_user_data_usage(db, user)
        if user.status == UserStatus.limited:
            xray_add_user(user)

        logger.info(f"User data usage reset for User \"{user.username}\"")


scheduler.add_job(reset_user_data_usage, 'interval', hours=1)

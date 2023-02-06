from datetime import datetime

from app import logger, scheduler
from app.db import get_users, get_db,  crud
from app.models.user import  UserDataLimitResetStrategy

reset_strategy_to_days = {
    UserDataLimitResetStrategy.day.value :1,
    UserDataLimitResetStrategy.week.value: 7,
    UserDataLimitResetStrategy.month.value : 30,
    UserDataLimitResetStrategy.year.value : 365,
}

def reset_user_data_usage():
    now = datetime.utcnow()
    db = next(get_db())
    for user in get_users(db, reset_strategy=[
        UserDataLimitResetStrategy.day.value,
        UserDataLimitResetStrategy.month.value,
        UserDataLimitResetStrategy.year.value,
        ]):
        last_reset_time = user.usage_logs[-1].reset_at if user.usage_logs else user.created_at
        num_days_to_reset = reset_strategy_to_days[user.data_limit_reset_strategy]
        if not  (now - last_reset_time).days >= num_days_to_reset:
            continue
        
        crud.reset_user_data_usage(db, user)

        logger.info(f"User data usage reset for User \"{user.username}\"")


scheduler.add_job(reset_user_data_usage, 'cron', hour="*/23", minute="*/59")

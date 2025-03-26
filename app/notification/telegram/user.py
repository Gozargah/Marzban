from app.notification.client import send_telegram_message
from app.models.user import UserResponse
from config import TELEGRAM_LOGGER_TOPIC_ID, TELEGRAM_LOGGER_CHANNEL_ID, TELEGRAM_ADMIN_ID, TELEGRAM_NOTIFY


_status = {
    "active": "**✅ #Activated**",
    "disabled": "**❌ #Disabled**",
    "limited": "**🪫 #Limited**",
    "expired": "**🕔 #Expired**",
}


async def user_status_change(user: UserResponse, by: str):
    data = (
        _status[user.status.value]
        + "➖➖➖➖➖➖➖➖➖\n"
        + f"**Username:** {user.username}\n"
        + "➖➖➖➖➖➖➖➖➖\n"
        + f"_Belongs To: {user.admin.username if user.admin else None}_\n"
        + f"_By: #{by}_"
    )
    if TELEGRAM_NOTIFY:
        await send_telegram_message(data, TELEGRAM_ADMIN_ID, TELEGRAM_LOGGER_CHANNEL_ID, TELEGRAM_LOGGER_TOPIC_ID)
    if user.admin and user.admin.telegram_id:
        await send_telegram_message(data, chat_id=user.admin.telegram_id)


async def create_user(user: UserResponse, by: str):
    data = (
        "*🆕 #Create User*\n"
        + "➖➖➖➖➖➖➖➖➖\n"
        + f"**Username:** {user.username}\n"
        + f"**Data Limit**: {user.data_limit}"
        + f"**Expire Date:** {user.expire}"
        + f"**Data Limit Reset Strategy:** {user.data_limit_reset_strategy.value}"
        + f"**Has Next Plan**: {bool(user.next_plan)}"
        + "➖➖➖➖➖➖➖➖➖\n"
        + f"_Belongs To: {user.admin.username if user.admin else None}_\n"
        + f"_By: #{by}_"
    )
    if TELEGRAM_NOTIFY:
        await send_telegram_message(data, TELEGRAM_ADMIN_ID, TELEGRAM_LOGGER_CHANNEL_ID, TELEGRAM_LOGGER_TOPIC_ID)
    if user.admin and user.admin.telegram_id:
        await send_telegram_message(data, chat_id=user.admin.telegram_id)


async def modify_user(user: UserResponse, by: str):
    data = (
        "*✏️ #Modify User*\n"
        + "➖➖➖➖➖➖➖➖➖\n"
        + f"**Username:** {user.username}\n"
        + f"**Data Limit**: {user.data_limit}"
        + f"**Expire Date:** {user.expire}"
        + f"**Data Limit Reset Strategy:** {user.data_limit_reset_strategy.value}"
        + f"**Has Next Plan**: {bool(user.next_plan)}"
        + "➖➖➖➖➖➖➖➖➖\n"
        + f"_Belongs To: {user.admin.username if user.admin else None}_\n"
        + f"_By: #{by}_"
    )
    if TELEGRAM_NOTIFY:
        await send_telegram_message(data, TELEGRAM_ADMIN_ID, TELEGRAM_LOGGER_CHANNEL_ID, TELEGRAM_LOGGER_TOPIC_ID)
    if user.admin and user.admin.telegram_id:
        await send_telegram_message(data, chat_id=user.admin.telegram_id)


async def remove_user(user: UserResponse, by: str):
    data = (
        "🗑️ #Remove User"
        + "➖➖➖➖➖➖➖➖➖\n"
        + f"**Username:** {user.username}\n"
        + "➖➖➖➖➖➖➖➖➖\n"
        + f"_Belongs To: {user.admin.username if user.admin else None}_\n"
        + f"_By: #{by}_"
    )
    if TELEGRAM_NOTIFY:
        await send_telegram_message(data, TELEGRAM_ADMIN_ID, TELEGRAM_LOGGER_CHANNEL_ID, TELEGRAM_LOGGER_TOPIC_ID)
    if user.admin and user.admin.telegram_id:
        await send_telegram_message(data, chat_id=user.admin.telegram_id)


async def reset_user_data_usage(user: UserResponse, by: str):
    data = (
        "🔁 #Reset User Data Usage"
        + "➖➖➖➖➖➖➖➖➖\n"
        + f"**Username:** {user.username}\n"
        + f"**Data Limit:** {user.data_limit}"
        + "➖➖➖➖➖➖➖➖➖\n"
        + f"_Belongs To: {user.admin.username if user.admin else None}_\n"
        + f"_By: #{by}_"
    )
    if TELEGRAM_NOTIFY:
        await send_telegram_message(data, TELEGRAM_ADMIN_ID, TELEGRAM_LOGGER_CHANNEL_ID, TELEGRAM_LOGGER_TOPIC_ID)
    if user.admin and user.admin.telegram_id:
        await send_telegram_message(data, chat_id=user.admin.telegram_id)


async def user_data_reset_by_next(user: UserResponse, by: str):
    data = (
        "🔁 #Reset User By Next"
        + "➖➖➖➖➖➖➖➖➖\n"
        + f"**Username:** {user.username}\n"
        + f"**Data Limit:** {user.data_limit}"
        + f"**Expire Date:** {user.expire}"
        + "➖➖➖➖➖➖➖➖➖\n"
        + f"_Belongs To: {user.admin.username if user.admin else None}_\n"
        + f"_By: #{by}_"
    )
    if TELEGRAM_NOTIFY:
        await send_telegram_message(data, TELEGRAM_ADMIN_ID, TELEGRAM_LOGGER_CHANNEL_ID, TELEGRAM_LOGGER_TOPIC_ID)
    if user.admin and user.admin.telegram_id:
        await send_telegram_message(data, chat_id=user.admin.telegram_id)


async def user_subscription_revoked(user: UserResponse, by: str):
    data = (
        "🛑 #Revoke User Subscribtion"
        + "➖➖➖➖➖➖➖➖➖\n"
        + f"**Username:** {user.username}\n"
        + "➖➖➖➖➖➖➖➖➖\n"
        + f"_Belongs To: {user.admin.username if user.admin else None}_\n"
        + f"_By: #{by}_"
    )
    if TELEGRAM_NOTIFY:
        await send_telegram_message(data, TELEGRAM_ADMIN_ID, TELEGRAM_LOGGER_CHANNEL_ID, TELEGRAM_LOGGER_TOPIC_ID)
    if user.admin and user.admin.telegram_id:
        await send_telegram_message(data, chat_id=user.admin.telegram_id)

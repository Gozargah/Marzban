from app.notification.client import send_telegram_message
from app.models.user import UserResponse
from app.utils.system import readable_size
from app.models.settings import NotficationSettings
from app.settings import notfication_settings

_status = {
    "active": "**✅ #Activated**",
    "on_hold": "**🕔 #On_Hold**",
    "disabled": "**❌ #Disabled**",
    "limited": "**🪫 #Limited**",
    "expired": "**📅 #Expired**",
}


async def user_status_change(user: UserResponse, by: str):
    data = (
        _status[user.status.value]
        + "\n➖➖➖➖➖➖➖➖➖\n"
        + f"**Username:** `{user.username}`\n"
        + "➖➖➖➖➖➖➖➖➖\n"
        + f"_Belongs To_: `{user.admin.username if user.admin else None}`\n"
        + f"_By: #{by}_"
    )
    settings: NotficationSettings = await notfication_settings()
    if settings.notify_telegram:
        await send_telegram_message(
            data, settings.telegram_admin_id, settings.telegram_channel_id, settings.telegram_topic_id
        )
    if user.admin and user.admin.telegram_id:
        await send_telegram_message(data, chat_id=user.admin.telegram_id)


async def create_user(user: UserResponse, by: str):
    data = (
        "*🆕 #Create_User*\n"
        + "➖➖➖➖➖➖➖➖➖\n"
        + f"**Username:** `{user.username}`\n"
        + f"**Data Limit**: `{readable_size(user.data_limit) if user.data_limit else 'Unlimited'}`\n"
        + f"**Expire Date:** `{user.expire if user.expire else 'Never'}`\n"
        + f"**Data Limit Reset Strategy:** `{user.data_limit_reset_strategy.value}`\n"
        + f"**Has Next Plan**: `{bool(user.next_plan)}`\n"
        + "➖➖➖➖➖➖➖➖➖\n"
        + f"_Belongs To_: `{user.admin.username if user.admin else None}`\n"
        + f"_By: #{by}_"
    )
    settings: NotficationSettings = await notfication_settings()
    if settings.notify_telegram:
        await send_telegram_message(
            data, settings.telegram_admin_id, settings.telegram_channel_id, settings.telegram_topic_id
        )
    if user.admin and user.admin.telegram_id:
        await send_telegram_message(data, chat_id=user.admin.telegram_id)


async def modify_user(user: UserResponse, by: str):
    data = (
        "*✏️ #Modify_User*\n"
        + "➖➖➖➖➖➖➖➖➖\n"
        + f"**Username:** `{user.username}`\n"
        + f"**Data Limit**: `{readable_size(user.data_limit) if user.data_limit else 'Unlimited'}`\n"
        + f"**Expire Date:** `{user.expire if user.expire else 'Never'}`\n"
        + f"**Data Limit Reset Strategy:** `{user.data_limit_reset_strategy.value}`\n"
        + f"**Has Next Plan**: `{bool(user.next_plan)}`\n"
        + "➖➖➖➖➖➖➖➖➖\n"
        + f"_Belongs To_: `{user.admin.username if user.admin else None}`\n"
        + f"_By: #{by}_"
    )
    settings: NotficationSettings = await notfication_settings()
    if settings.notify_telegram:
        await send_telegram_message(
            data, settings.telegram_admin_id, settings.telegram_channel_id, settings.telegram_topic_id
        )
    if user.admin and user.admin.telegram_id:
        await send_telegram_message(data, chat_id=user.admin.telegram_id)


async def remove_user(user: UserResponse, by: str):
    data = (
        "🗑️ #Remove_User\n"
        + "➖➖➖➖➖➖➖➖➖\n"
        + f"**Username:** `{user.username}`\n"
        + "➖➖➖➖➖➖➖➖➖\n"
        + f"_Belongs To_: `{user.admin.username if user.admin else None}`\n"
        + f"_By: #{by}_"
    )
    settings: NotficationSettings = await notfication_settings()
    if settings.notify_telegram:
        await send_telegram_message(
            data, settings.telegram_admin_id, settings.telegram_channel_id, settings.telegram_topic_id
        )
    if user.admin and user.admin.telegram_id:
        await send_telegram_message(data, chat_id=user.admin.telegram_id)


async def reset_user_data_usage(user: UserResponse, by: str):
    data = (
        "🔁 #Reset_User_Data_Usage\n"
        + "➖➖➖➖➖➖➖➖➖\n"
        + f"**Username:** `{user.username}`\n"
        + f"**Data Limit**: `{readable_size(user.data_limit) if user.data_limit else 'Unlimited'}`\n"
        + "➖➖➖➖➖➖➖➖➖\n"
        + f"_Belongs To_: `{user.admin.username if user.admin else None}`\n"
        + f"_By: #{by}_"
    )
    settings: NotficationSettings = await notfication_settings()
    if settings.notify_telegram:
        await send_telegram_message(
            data, settings.telegram_admin_id, settings.telegram_channel_id, settings.telegram_topic_id
        )
    if user.admin and user.admin.telegram_id:
        await send_telegram_message(data, chat_id=user.admin.telegram_id)


async def user_data_reset_by_next(user: UserResponse, by: str):
    data = (
        "🔁 #Reset_User_By_Next\n"
        + "➖➖➖➖➖➖➖➖➖\n"
        + f"**Username:** `{user.username}`\n"
        + f"**Data Limit**: `{readable_size(user.data_limit) if user.data_limit else 'Unlimited'}`\n"
        + f"**Expire Date:** `{user.expire if user.expire else 'Never'}`\n"
        + "➖➖➖➖➖➖➖➖➖\n"
        + f"_Belongs To_: `{user.admin.username if user.admin else None}`\n"
        + f"_By: #{by}_"
    )
    settings: NotficationSettings = await notfication_settings()
    if settings.notify_telegram:
        await send_telegram_message(
            data, settings.telegram_admin_id, settings.telegram_channel_id, settings.telegram_topic_id
        )
    if user.admin and user.admin.telegram_id:
        await send_telegram_message(data, chat_id=user.admin.telegram_id)


async def user_subscription_revoked(user: UserResponse, by: str):
    data = (
        "🛑 #Revoke_User_Subscribtion\n"
        + "➖➖➖➖➖➖➖➖➖\n"
        + f"**Username:** `{user.username}`\n"
        + "➖➖➖➖➖➖➖➖➖\n"
        + f"_Belongs To_: `{user.admin.username if user.admin else None}`\n"
        + f"_By: #{by}_"
    )
    settings: NotficationSettings = await notfication_settings()
    if settings.notify_telegram:
        await send_telegram_message(
            data, settings.telegram_admin_id, settings.telegram_channel_id, settings.telegram_topic_id
        )
    if user.admin and user.admin.telegram_id:
        await send_telegram_message(data, chat_id=user.admin.telegram_id)

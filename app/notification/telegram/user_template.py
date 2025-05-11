from app.notification.client import send_telegram_message
from app.models.user_template import UserTemplateResponse
from app.models.settings import NotificationSettings
from app.settings import notification_settings


async def create_user_template(user_template: UserTemplateResponse, by: str):
    data = (
        "*#Create_User_Template*\n"
        + "➖➖➖➖➖➖➖➖➖\n"
        + f"**Name:** `{user_template.name}`\n"
        + f"**Data Limit:** `{user_template.data_limit}`\n"
        + f"**Expire Duration:** `{user_template.expire_duration}`\n"
        + f"**Username Prefix:** `{user_template.username_prefix}`\n"
        + f"**Username Suffix:** `{user_template.username_suffix}`\n"
        + "➖➖➖➖➖➖➖➖➖\n"
        + f"_By: #{by}_"
    )
    settings: NotificationSettings = await notification_settings()
    if settings.notify_telegram:
        await send_telegram_message(
            data, settings.telegram_admin_id, settings.telegram_channel_id, settings.telegram_topic_id
        )


async def modify_user_template(user_template: UserTemplateResponse, by: str):
    data = (
        "*#Modify_User_Template*\n"
        + "➖➖➖➖➖➖➖➖➖\n"
        + f"**Name:** `{user_template.name}`\n"
        + f"**Data Limit:** `{user_template.data_limit}`\n"
        + f"**Expire Duration:** `{user_template.expire_duration}`\n"
        + f"**Username Prefix:** `{user_template.username_prefix}`\n"
        + f"**Username Suffix:** `{user_template.username_suffix}`\n"
        + "➖➖➖➖➖➖➖➖➖\n"
        + f"_By: #{by}_"
    )
    settings: NotificationSettings = await notification_settings()
    if settings.notify_telegram:
        await send_telegram_message(
            data, settings.telegram_admin_id, settings.telegram_channel_id, settings.telegram_topic_id
        )


async def remove_user_template(name: str, by: str):
    data = "*#Remove_User_Template*\n" + f"**Name:** `{name}`\n" + "➖➖➖➖➖➖➖➖➖\n" + f"_By: #{by}_"
    settings: NotificationSettings = await notification_settings()
    if settings.notify_telegram:
        await send_telegram_message(
            data, settings.telegram_admin_id, settings.telegram_channel_id, settings.telegram_topic_id
        )

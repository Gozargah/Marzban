from app.notification.client import send_telegram_message
from app.models.user_template import UserTemplateResponse
from config import TELEGRAM_LOGGER_TOPIC_ID, TELEGRAM_LOGGER_CHANNEL_ID, TELEGRAM_ADMIN_ID, TELEGRAM_NOTIFY


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
    if TELEGRAM_NOTIFY:
        await send_telegram_message(data, TELEGRAM_ADMIN_ID, TELEGRAM_LOGGER_CHANNEL_ID, TELEGRAM_LOGGER_TOPIC_ID)


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
    if TELEGRAM_NOTIFY:
        await send_telegram_message(data, TELEGRAM_ADMIN_ID, TELEGRAM_LOGGER_CHANNEL_ID, TELEGRAM_LOGGER_TOPIC_ID)


async def remove_user_template(name: str, by: str):
    data = "*#Remove_User_Template*\n" + f"**Name:** `{name}`\n" + "➖➖➖➖➖➖➖➖➖\n" + f"_By: #{by}_"
    if TELEGRAM_NOTIFY:
        await send_telegram_message(data, TELEGRAM_ADMIN_ID, TELEGRAM_LOGGER_CHANNEL_ID, TELEGRAM_LOGGER_TOPIC_ID)

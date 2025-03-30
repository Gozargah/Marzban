from app.notification.client import send_telegram_message
from app.models.group import GroupResponse
from config import TELEGRAM_LOGGER_TOPIC_ID, TELEGRAM_LOGGER_CHANNEL_ID, TELEGRAM_ADMIN_ID, TELEGRAM_NOTIFY


async def create_group(group: GroupResponse, by: str):
    data = (
        "*#Create_Group*\n"
        + "➖➖➖➖➖➖➖➖➖\n"
        + f"**Name:** `{group.name}`\n"
        + f"**Inbound Tags:** `{group.inbound_tags}`\n"
        + f"**Is Disabled:** `{group.is_disabled}`\n"
        + "➖➖➖➖➖➖➖➖➖\n"
        + f"_ID_: `{group.id}`\n"
        + f"_By: #{by}_"
    )
    if TELEGRAM_NOTIFY:
        await send_telegram_message(data, TELEGRAM_ADMIN_ID, TELEGRAM_LOGGER_CHANNEL_ID, TELEGRAM_LOGGER_TOPIC_ID)


async def modify_group(group: GroupResponse, by: str):
    data = (
        "*#Modify_Group*\n"
        + "➖➖➖➖➖➖➖➖➖\n"
        + f"**Name:** `{group.name}`\n"
        + f"**Inbound Tags:** `{group.inbound_tags}`\n"
        + f"**Is Disabled:** `{group.is_disabled}`\n"
        + "➖➖➖➖➖➖➖➖➖\n"
        + f"_ID_: `{group.id}`\n"
        + f"_By: #{by}_"
    )
    if TELEGRAM_NOTIFY:
        await send_telegram_message(data, TELEGRAM_ADMIN_ID, TELEGRAM_LOGGER_CHANNEL_ID, TELEGRAM_LOGGER_TOPIC_ID)


async def remove_group(group_id: int, by: str):
    data = (
        "*#Remove_Group*\n"
        + "➖➖➖➖➖➖➖➖➖\n"
        + f"**ID:** `{group_id}`\n"
        + "➖➖➖➖➖➖➖➖➖\n"
        + f"_By: #{by}_"
    )
    if TELEGRAM_NOTIFY:
        await send_telegram_message(data, TELEGRAM_ADMIN_ID, TELEGRAM_LOGGER_CHANNEL_ID, TELEGRAM_LOGGER_TOPIC_ID)

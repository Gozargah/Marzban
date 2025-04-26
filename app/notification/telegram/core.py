from app.notification.client import send_telegram_message
from app.models.core import CoreResponse
from config import TELEGRAM_LOGGER_TOPIC_ID, TELEGRAM_LOGGER_CHANNEL_ID, TELEGRAM_ADMIN_ID, TELEGRAM_NOTIFY


async def create_core(core: CoreResponse, by: str):
    data = (
        "*#Create_core*\n"
        + "➖➖➖➖➖➖➖➖➖\n"
        + f"**Name:** `{core.name}`\n"
        + f"**Exclude inbound tags:** `{core.exclude_inbound_tags}`\n"
        + f"**Fallbacks inbound tags:** `{core.fallbacks_inbound_tags}`\n"
        + "➖➖➖➖➖➖➖➖➖\n"
        + f"_ID_: `{core.id}`\n"
        + f"_By: #{by}_"
    )
    if TELEGRAM_NOTIFY:
        await send_telegram_message(data, TELEGRAM_ADMIN_ID, TELEGRAM_LOGGER_CHANNEL_ID, TELEGRAM_LOGGER_TOPIC_ID)


async def modify_core(core: CoreResponse, by: str):
    data = (
        "*#Modify_core*\n"
        + "➖➖➖➖➖➖➖➖➖\n"
        + f"**Name:** `{core.name}`\n"
        + f"**Exclude inbound tags:** `{core.exclude_inbound_tags}`\n"
        + f"**Fallbacks inbound tags:** `{core.fallbacks_inbound_tags}`\n"
        + "➖➖➖➖➖➖➖➖➖\n"
        + f"_ID_: `{core.id}`\n"
        + f"_By: #{by}_"
    )
    if TELEGRAM_NOTIFY:
        await send_telegram_message(data, TELEGRAM_ADMIN_ID, TELEGRAM_LOGGER_CHANNEL_ID, TELEGRAM_LOGGER_TOPIC_ID)


async def remove_core(core_id: int, by: str):
    data = (
        "*#Remove_core*\n" + "➖➖➖➖➖➖➖➖➖\n" + f"**ID:** `{core_id}`\n" + "➖➖➖➖➖➖➖➖➖\n" + f"_By: #{by}_"
    )
    if TELEGRAM_NOTIFY:
        await send_telegram_message(data, TELEGRAM_ADMIN_ID, TELEGRAM_LOGGER_CHANNEL_ID, TELEGRAM_LOGGER_TOPIC_ID)

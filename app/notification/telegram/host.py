from app.notification.client import send_telegram_message
from app.models.host import BaseHost
from config import TELEGRAM_LOGGER_TOPIC_ID, TELEGRAM_LOGGER_CHANNEL_ID, TELEGRAM_ADMIN_ID, TELEGRAM_NOTIFY


async def create_host(host: BaseHost, by: str):
    data = (
        "*Create Host*\n"
        + "➖➖➖➖➖➖➖➖➖\n"
        + f"**Remark:** `{host.remark}`\n"
        + f"**Address:** `{host.address}`\n"
        + f"**Inbound Tag:** `{host.inbound_tag}`\n"
        + f"**Port:** `{host.port}`\n"
        + "➖➖➖➖➖➖➖➖➖\n"
        + f"_ID: `{host.id}`_\n"
        + f"_By: #{by}_"
    )
    if TELEGRAM_NOTIFY:
        await send_telegram_message(data, TELEGRAM_ADMIN_ID, TELEGRAM_LOGGER_CHANNEL_ID, TELEGRAM_LOGGER_TOPIC_ID)


async def modify_host(host: BaseHost, by: str):
    data = (
        "*#Modify Host*\n"
        + "➖➖➖➖➖➖➖➖➖\n"
        + f"**Remark:** `{host.remark}`\n"
        + f"**Address:** `{host.address}`\n"
        + f"**Inbound Tag:** `{host.inbound_tag}`\n"
        + f"**Port:** `{host.port}`\n\n"
        + "➖➖➖➖➖➖➖➖➖\n"
        + f"_ID: `{host.id}`_\n"
        + f"_By: #{by}_"
    )
    if TELEGRAM_NOTIFY:
        await send_telegram_message(data, TELEGRAM_ADMIN_ID, TELEGRAM_LOGGER_CHANNEL_ID, TELEGRAM_LOGGER_TOPIC_ID)


async def remove_host(host: BaseHost, by: str):
    data = (
        "*#Remove Host*\n"
        + "➖➖➖➖➖➖➖➖➖\n"
        + f"**Remark:** `{host.remark}`\n"
        + "➖➖➖➖➖➖➖➖➖\n"
        + f"_ID: {host.id}_\n"
        + f"_By: #{by}_"
    )
    if TELEGRAM_NOTIFY:
        await send_telegram_message(data, TELEGRAM_ADMIN_ID, TELEGRAM_LOGGER_CHANNEL_ID, TELEGRAM_LOGGER_TOPIC_ID)


async def update_hosts(by: str):
    data = f"*#Add Host*\n➖➖➖➖➖➖➖➖➖\nAll hosts has been updated by **#{by}**"
    if TELEGRAM_NOTIFY:
        await send_telegram_message(data, TELEGRAM_ADMIN_ID, TELEGRAM_LOGGER_CHANNEL_ID, TELEGRAM_LOGGER_TOPIC_ID)

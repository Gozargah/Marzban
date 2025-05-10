from app.notification.client import send_telegram_message
from app.models.host import BaseHost
from app.models.settings import NotficationSettings
from app.settings import notfication_settings


async def create_host(host: BaseHost, by: str):
    data = (
        "*#Create_Host*\n"
        + "➖➖➖➖➖➖➖➖➖\n"
        + f"**Remark:** `{host.remark}`\n"
        + f"**Address:** `{host.address}`\n"
        + f"**Inbound Tag:** `{host.inbound_tag}`\n"
        + f"**Port:** `{host.port}`\n"
        + "➖➖➖➖➖➖➖➖➖\n"
        + f"_ID_: `{host.id}`\n"
        + f"_By: #{by}_"
    )
    settings: NotficationSettings = await notfication_settings()
    if settings.notify_telegram:
        await send_telegram_message(
            data, settings.telegram_admin_id, settings.telegram_channel_id, settings.telegram_topic_id
        )


async def modify_host(host: BaseHost, by: str):
    data = (
        "*#Modify_Host*\n"
        + "➖➖➖➖➖➖➖➖➖\n"
        + f"**Remark:** `{host.remark}`\n"
        + f"**Address:** `{host.address}`\n"
        + f"**Inbound Tag:** `{host.inbound_tag}`\n"
        + f"**Port:** `{host.port}`\n\n"
        + "➖➖➖➖➖➖➖➖➖\n"
        + f"_ID_: `{host.id}`\n"
        + f"_By: #{by}_"
    )
    settings: NotficationSettings = await notfication_settings()
    if settings.notify_telegram:
        await send_telegram_message(
            data, settings.telegram_admin_id, settings.telegram_channel_id, settings.telegram_topic_id
        )


async def remove_host(host: BaseHost, by: str):
    data = (
        "*#Remove_Host*\n"
        + "➖➖➖➖➖➖➖➖➖\n"
        + f"**Remark:** `{host.remark}`\n"
        + "➖➖➖➖➖➖➖➖➖\n"
        + f"_ID_: {host.id}\n"
        + f"_By: #{by}_"
    )
    settings: NotficationSettings = await notfication_settings()
    if settings.notify_telegram:
        await send_telegram_message(
            data, settings.telegram_admin_id, settings.telegram_channel_id, settings.telegram_topic_id
        )


async def modify_hosts(by: str):
    data = f"*#Modify_Hosts*\n➖➖➖➖➖➖➖➖➖\nAll hosts has been updated by **#{by}**"
    settings: NotficationSettings = await notfication_settings()
    if settings.notify_telegram:
        await send_telegram_message(
            data, settings.telegram_admin_id, settings.telegram_channel_id, settings.telegram_topic_id
        )

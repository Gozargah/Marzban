from app.notification.client import send_telegram_message
from app.models.core import CoreResponse
from app.models.settings import NotficationSettings
from app.settings import notfication_settings


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
    settings: NotficationSettings = await notfication_settings()
    if settings.notify_telegram:
        await send_telegram_message(
            data, settings.telegram_admin_id, settings.telegram_channel_id, settings.telegram_topic_id
        )


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
    settings: NotficationSettings = await notfication_settings()
    if settings.notify_telegram:
        await send_telegram_message(
            data, settings.telegram_admin_id, settings.telegram_channel_id, settings.telegram_topic_id
        )


async def remove_core(core_id: int, by: str):
    data = (
        "*#Remove_core*\n" + "➖➖➖➖➖➖➖➖➖\n" + f"**ID:** `{core_id}`\n" + "➖➖➖➖➖➖➖➖➖\n" + f"_By: #{by}_"
    )
    settings: NotficationSettings = await notfication_settings()
    if settings.notify_telegram:
        await send_telegram_message(
            data, settings.telegram_admin_id, settings.telegram_channel_id, settings.telegram_topic_id
        )

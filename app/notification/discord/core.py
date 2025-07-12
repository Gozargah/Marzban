import copy

from app.notification.client import send_discord_webhook
from app.models.core import CoreResponse
from app.models.settings import NotificationSettings
from app.settings import notification_settings
from app.utils.helpers import escape_ds_markdown

from . import colors, messages
from .utils import escape_md_core


async def create_core(core: CoreResponse, by: str):
    name, exclude_inbound_tags, fallbacks_inbound_tags, by = escape_md_core(core, by)
    message = copy.deepcopy(messages.CREATE_CORE)
    message["description"] = message["description"].format(
        name=name,
        exclude_inbound_tags=exclude_inbound_tags,
        fallbacks_inbound_tags=fallbacks_inbound_tags,
    )
    message["footer"]["text"] = message["footer"]["text"].format(id=core.id, by=by)
    data = {
        "content": "",
        "embeds": [message],
    }
    data["embeds"][0]["color"] = colors.GREEN
    settings: NotificationSettings = await notification_settings()
    if settings.notify_discord:
        await send_discord_webhook(data, settings.discord_webhook_url)


async def modify_core(core: CoreResponse, by: str):
    name, exclude_inbound_tags, fallbacks_inbound_tags, by = escape_md_core(core, by)
    message = copy.deepcopy(messages.MODIFY_CORE)
    message["description"] = message["description"].format(
        name=name,
        exclude_inbound_tags=exclude_inbound_tags,
        fallbacks_inbound_tags=fallbacks_inbound_tags,
    )
    message["footer"]["text"] = message["footer"]["text"].format(id=core.id, by=by)
    data = {
        "content": "",
        "embeds": [message],
    }
    data["embeds"][0]["color"] = colors.YELLOW
    settings: NotificationSettings = await notification_settings()
    if settings.notify_discord:
        await send_discord_webhook(data, settings.discord_webhook_url)


async def remove_core(core_id: int, by: str):
    by = escape_ds_markdown(by)
    message = copy.deepcopy(messages.REMOVE_CORE)
    message["description"] = message["description"].format(id=core_id)
    message["footer"]["text"] = message["footer"]["text"].format(by=by)
    data = {
        "content": "",
        "embeds": [message],
    }
    data["embeds"][0]["color"] = colors.RED
    settings: NotificationSettings = await notification_settings()
    if settings.notify_discord:
        await send_discord_webhook(data, settings.discord_webhook_url)

import copy

from app.notification.client import send_discord_webhook
from app.models.group import GroupResponse
from app.models.settings import NotificationSettings
from app.settings import notification_settings
from app.utils.helpers import escape_ds_markdown_list, escape_ds_markdown

from . import colors, messages


async def create_group(group: GroupResponse, by: str):
    name, by = escape_ds_markdown_list((group.name, by))
    message = copy.deepcopy(messages.CREATE_GROUP)
    message["description"] = message["description"].format(
        name=name,
        inbound_tags=group.inbound_tags,
        is_disabled=group.is_disabled,
    )
    message["footer"]["text"] = message["footer"]["text"].format(id=group.id, by=by)
    data = {
        "content": "",
        "embeds": [message],
    }
    data["embeds"][0]["color"] = colors.GREEN
    settings: NotificationSettings = await notification_settings()
    if settings.notify_discord:
        await send_discord_webhook(data, settings.discord_webhook_url)


async def modify_group(group: GroupResponse, by: str):
    name, by = escape_ds_markdown_list((group.name, by))
    message = copy.deepcopy(messages.MODIFY_GROUP)
    message["description"] = message["description"].format(
        name=name,
        inbound_tags=group.inbound_tags,
        is_disabled=group.is_disabled,
    )
    message["footer"]["text"] = message["footer"]["text"].format(id=group.id, by=by)
    data = {
        "content": "",
        "embeds": [message],
    }
    data["embeds"][0]["color"] = colors.YELLOW
    settings: NotificationSettings = await notification_settings()
    if settings.notify_discord:
        await send_discord_webhook(data, settings.discord_webhook_url)


async def remove_group(group_id: int, by: str):
    by = escape_ds_markdown(by)
    message = copy.deepcopy(messages.REMOVE_GROUP)
    message["description"] = message["description"].format(id=group_id)
    message["footer"]["text"] = message["footer"]["text"].format(by=by)
    data = {
        "content": "",
        "embeds": [message],
    }
    data["embeds"][0]["color"] = colors.RED
    settings: NotificationSettings = await notification_settings()
    if settings.notify_discord:
        await send_discord_webhook(data, settings.discord_webhook_url)

import copy

from app.notification.client import send_discord_webhook
from app.models.host import BaseHost
from app.models.settings import NotificationSettings
from app.settings import notification_settings
from app.utils.helpers import escape_ds_markdown_list, escape_ds_markdown

from .utils import escape_md_host
from . import colors, messages


async def create_host(host: BaseHost, by: str):
    remark, address, inbound_tag, by = escape_md_host(host, by)
    message = copy.deepcopy(messages.CREATE_HOST)
    message["description"] = message["description"].format(
        remark=remark, address=address, inbound_tag=inbound_tag, port=host.port
    )
    message["footer"]["text"] = message["footer"]["text"].format(id=host.id, by=by)
    data = {
        "content": "",
        "embeds": [message],
    }
    data["embeds"][0]["color"] = colors.GREEN
    settings: NotificationSettings = await notification_settings()
    if settings.notify_discord:
        await send_discord_webhook(data, settings.discord_webhook_url)


async def modify_host(host: BaseHost, by: str):
    remark, address, inbound_tag, by = escape_md_host(host, by)
    message = copy.deepcopy(messages.MODIFY_HOST)
    message["description"] = message["description"].format(
        remark=remark, address=address, inbound_tag=inbound_tag, port=host.port
    )
    message["footer"]["text"] = message["footer"]["text"].format(id=host.id, by=by)
    data = {
        "content": "",
        "embeds": [message],
    }
    data["embeds"][0]["color"] = colors.YELLOW
    settings: NotificationSettings = await notification_settings()
    if settings.notify_discord:
        await send_discord_webhook(data, settings.discord_webhook_url)


async def remove_host(host: BaseHost, by: str):
    remark, by = escape_ds_markdown_list((host.remark, by))
    message = copy.deepcopy(messages.REMOVE_HOST)
    message["description"] = message["description"].format(remark=remark)
    message["footer"]["text"] = message["footer"]["text"].format(id=host.id, by=by)
    data = {
        "content": "",
        "embeds": [message],
    }
    data["embeds"][0]["color"] = colors.RED
    settings: NotificationSettings = await notification_settings()
    if settings.notify_discord:
        await send_discord_webhook(data, settings.discord_webhook_url)


async def modify_hosts(by: str):
    by = escape_ds_markdown(by)
    message = copy.deepcopy(messages.MODIFY_HOSTS)
    message["description"] = message["description"].format(by=by)
    data = {
        "content": "",
        "embeds": [message],
    }
    data["embeds"][0]["color"] = colors.CYAN
    settings: NotificationSettings = await notification_settings()
    if settings.notify_discord:
        await send_discord_webhook(data, settings.discord_webhook_url)

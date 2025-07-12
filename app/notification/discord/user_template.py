import copy

from app.notification.client import send_discord_webhook
from app.models.user_template import UserTemplateResponse
from app.models.settings import NotificationSettings
from app.settings import notification_settings
from app.utils.helpers import escape_ds_markdown_list

from . import colors, messages
from .utils import escape_md_template


async def create_user_template(user_tempelate: UserTemplateResponse, by: str):
    name, username_prefix, username_suffix, by = escape_md_template(user_tempelate, by)
    message = copy.deepcopy(messages.CREATE_USER_TEMPLATE)
    message["description"] = message["description"].format(
        name=name,
        data_limit=user_tempelate.data_limit,
        expire_duration=user_tempelate.expire_duration,
        username_prefix=username_prefix,
        username_suffix=username_suffix,
    )
    message["footer"]["text"] = message["footer"]["text"].format(by=by)
    data = {
        "content": "",
        "embeds": [message],
    }
    data["embeds"][0]["color"] = colors.GREEN
    settings: NotificationSettings = await notification_settings()
    if settings.notify_discord:
        await send_discord_webhook(data, settings.discord_webhook_url)


async def modify_user_template(user_template: UserTemplateResponse, by: str):
    name, username_prefix, username_suffix, by = escape_md_template(user_template, by)
    message = copy.deepcopy(messages.MODIFY_USER_TEMPLATE)
    message["description"] = message["description"].format(
        name=name,
        data_limit=user_template.data_limit,
        expire_duration=user_template.expire_duration,
        username_prefix=username_prefix,
        username_suffix=username_suffix,
    )
    message["footer"]["text"] = message["footer"]["text"].format(by=by)
    data = {
        "content": "",
        "embeds": [message],
    }
    data["embeds"][0]["color"] = colors.YELLOW
    settings: NotificationSettings = await notification_settings()
    if settings.notify_discord:
        await send_discord_webhook(data, settings.discord_webhook_url)


async def remove_user_template(name: str, by: str):
    name, by = escape_ds_markdown_list((name, by))
    message = copy.deepcopy(messages.REMOVE_USER_TEMPLATE)
    message["description"] = message["description"].format(name=name)
    message["footer"]["text"] = message["footer"]["text"].format(by=by)
    data = {
        "content": "",
        "embeds": [message],
    }
    data["embeds"][0]["color"] = colors.RED
    settings: NotificationSettings = await notification_settings()
    if settings.notify_discord:
        await send_discord_webhook(data, settings.discord_webhook_url)

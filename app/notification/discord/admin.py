import copy

from app.notification.client import send_discord_webhook
from app.models.admin import AdminDetails
from app.models.settings import NotificationSettings
from app.settings import notification_settings
from app.utils.helpers import escape_ds_markdown_list

from . import colors, messages


async def create_admin(admin: AdminDetails, by: str):
    username, by = escape_ds_markdown_list((admin.username, by))
    message = copy.deepcopy(messages.CREATE_ADMIN)
    message["description"] = message["description"].format(
        username=username,
        is_sudo=admin.is_sudo,
        is_disabled=admin.is_disabled,
        used_traffic=admin.used_traffic,
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


async def modify_admin(admin: AdminDetails, by: str):
    username, by = escape_ds_markdown_list((admin.username, by))
    message = copy.deepcopy(messages.MODIFY_ADMIN)
    message["description"] = message["description"].format(
        username=username,
        is_sudo=admin.is_sudo,
        is_disabled=admin.is_disabled,
        used_traffic=admin.used_traffic,
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


async def remove_admin(username: str, by: str):
    username, by = escape_ds_markdown_list((username, by))
    message = copy.deepcopy(messages.REMOVE_ADMIN)
    message["description"] = message["description"].format(username=username)
    message["footer"]["text"] = message["footer"]["text"].format(by=by)
    data = {
        "content": "",
        "embeds": [message],
    }
    data["embeds"][0]["color"] = colors.RED
    settings: NotificationSettings = await notification_settings()
    if settings.notify_discord:
        await send_discord_webhook(data, settings.discord_webhook_url)


async def admin_reset_usage(admin: AdminDetails, by: str):
    username, by = escape_ds_markdown_list((admin.username, by))
    message = copy.deepcopy(messages.ADMIN_RESET_USAGE)
    message["description"] = message["description"].format(username=username)
    message["footer"]["text"] = message["footer"]["text"].format(by=by)
    data = {
        "content": "",
        "embeds": [message],
    }
    data["embeds"][0]["color"] = colors.CYAN
    settings: NotificationSettings = await notification_settings()
    if settings.notify_discord:
        await send_discord_webhook(data, settings.discord_webhook_url)


async def admin_login(username: str, password: str, client_ip: str, success: bool):
    username, password = escape_ds_markdown_list((username, password))
    message = copy.deepcopy(messages.ADMIN_LOGIN)
    message["description"] = message["description"].format(
        username=username,
        password="🔒" if success else password,
        client_ip=client_ip,
    )
    message["footer"]["text"] = message["footer"]["text"].format(status="Successful" if success else "Failed")
    data = {
        "embeds": [message],
    }
    data["embeds"][0]["color"] = colors.GREEN if success else colors.RED
    settings: NotificationSettings = await notification_settings()
    if settings.notify_discord:
        await send_discord_webhook(data, settings.discord_webhook_url)

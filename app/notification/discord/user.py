import copy

from app.notification.client import send_discord_webhook
from app.models.user import UserNotificationResponse
from app.utils.system import readable_size
from app.models.settings import NotificationSettings
from app.settings import notification_settings

from . import colors, messages
from .utils import escape_md_user

_status = {
    "active": "**✅ Activated**",
    "on_hold": "**🕔 On Hold**",
    "disabled": "**❌ Disabled**",
    "limited": "**🪫 Limited**",
    "expired": "**📅 Expired**",
}
_status_color = {
    "active": colors.GREEN,
    "on_hold": colors.PURPLE,
    "disabled": colors.WHITE,
    "limited": colors.RED,
    "expired": colors.YELLOW,
}


async def user_status_change(user: UserNotificationResponse, by: str):
    username, admin_username, by = escape_md_user(user, by)
    message = copy.deepcopy(messages.USER_STATUS_CHANGE)
    message["title"] = message["title"].format(status=_status[user.status.value])
    message["description"] = message["description"].format(username=username)
    message["footer"]["text"] = message["footer"]["text"].format(admin_username=admin_username, by=by)
    data = {
        "content": "",
        "embeds": [message],
    }
    data["embeds"][0]["color"] = _status_color[user.status.value]
    settings: NotificationSettings = await notification_settings()
    if settings.notify_discord:
        await send_discord_webhook(data, settings.discord_webhook_url)
    if user.admin and user.admin.discord_webhook:
        await send_discord_webhook(data, user.admin.discord_webhook)


async def create_user(user: UserNotificationResponse, by: str):
    username, admin_username, by = escape_md_user(user, by)
    message = copy.deepcopy(messages.CREATE_USER)
    message["description"] = message["description"].format(
        username=username,
        data_limit=readable_size(user.data_limit) if user.data_limit else "Unlimited",
        expire_date=user.expire if user.expire else "Never",
        data_limit_reset_strategy=user.data_limit_reset_strategy.value,
        has_next_plan=bool(user.next_plan),
    )
    message["footer"]["text"] = message["footer"]["text"].format(admin_username=admin_username, by=by)
    data = {
        "content": "",
        "embeds": [message],
    }
    data["embeds"][0]["color"] = colors.GREEN
    settings: NotificationSettings = await notification_settings()
    if settings.notify_discord:
        await send_discord_webhook(data, settings.discord_webhook_url)
    if user.admin and user.admin.discord_webhook:
        await send_discord_webhook(data, user.admin.discord_webhook)


async def modify_user(user: UserNotificationResponse, by: str):
    username, admin_username, by = escape_md_user(user, by)
    message = copy.deepcopy(messages.MODIFY_USER)
    message["description"] = message["description"].format(
        username=username,
        data_limit=readable_size(user.data_limit) if user.data_limit else "Unlimited",
        expire_date=user.expire if user.expire else "Never",
        data_limit_reset_strategy=user.data_limit_reset_strategy.value,
        has_next_plan=bool(user.next_plan),
    )
    message["footer"]["text"] = message["footer"]["text"].format(admin_username=admin_username, by=by)
    data = {
        "content": "",
        "embeds": [message],
    }
    data["embeds"][0]["color"] = colors.YELLOW
    settings: NotificationSettings = await notification_settings()
    if settings.notify_discord:
        await send_discord_webhook(data, settings.discord_webhook_url)
    if user.admin and user.admin.discord_webhook:
        await send_discord_webhook(data, user.admin.discord_webhook)


async def remove_user(user: UserNotificationResponse, by: str):
    username, admin_username, by = escape_md_user(user, by)
    message = copy.deepcopy(messages.REMOVE_USER)
    message["description"] = message["description"].format(username=username)
    message["footer"]["text"] = message["footer"]["text"].format(id=user.id, admin_username=admin_username, by=by)
    data = {
        "content": "",
        "embeds": [message],
    }
    data["embeds"][0]["color"] = colors.RED
    settings: NotificationSettings = await notification_settings()
    if settings.notify_discord:
        await send_discord_webhook(data, settings.discord_webhook_url)
    if user.admin and user.admin.discord_webhook:
        await send_discord_webhook(data, user.admin.discord_webhook)


async def reset_user_data_usage(user: UserNotificationResponse, by: str):
    username, admin_username, by = escape_md_user(user, by)
    message = copy.deepcopy(messages.RESET_USER_DATA_USAGE)
    message["description"] = message["description"].format(
        username=username,
        data_limit=readable_size(user.data_limit) if user.data_limit else "Unlimited",
    )
    message["footer"]["text"] = message["footer"]["text"].format(id=user.id, admin_username=admin_username, by=by)
    data = {
        "content": "",
        "embeds": [message],
    }
    data["embeds"][0]["color"] = colors.CYAN
    settings: NotificationSettings = await notification_settings()
    if settings.notify_discord:
        await send_discord_webhook(data, settings.discord_webhook_url)
    if user.admin and user.admin.discord_webhook:
        await send_discord_webhook(data, user.admin.discord_webhook)


async def user_data_reset_by_next(user: UserNotificationResponse, by: str):
    username, admin_username, by = escape_md_user(user, by)
    message = copy.deepcopy(messages.USER_DATA_RESET_BY_NEXT)
    message["description"] = message["description"].format(
        username=username,
        data_limit=readable_size(user.data_limit) if user.data_limit else "Unlimited",
        expire_date=user.expire if user.expire else "Never",
    )
    message["footer"]["text"] = message["footer"]["text"].format(id=user.id, admin_username=admin_username, by=by)
    data = {
        "content": "",
        "embeds": [message],
    }
    data["embeds"][0]["color"] = colors.CYAN
    settings: NotificationSettings = await notification_settings()
    if settings.notify_discord:
        await send_discord_webhook(data, settings.discord_webhook_url)
    if user.admin and user.admin.discord_webhook:
        await send_discord_webhook(data, user.admin.discord_webhook)


async def user_subscription_revoked(user: UserNotificationResponse, by: str):
    username, admin_username, by = escape_md_user(user, by)
    message = copy.deepcopy(messages.USER_SUBSCRIPTION_REVOKED)
    message["description"] = message["description"].format(username=username)
    message["footer"]["text"] = message["footer"]["text"].format(id=user.id, admin_username=admin_username, by=by)
    data = {
        "content": "",
        "embeds": [message],
    }
    data["embeds"][0]["color"] = colors.RED
    settings: NotificationSettings = await notification_settings()
    if settings.notify_discord:
        await send_discord_webhook(data, settings.discord_webhook_url)
    if user.admin and user.admin.discord_webhook:
        await send_discord_webhook(data, user.admin.discord_webhook)

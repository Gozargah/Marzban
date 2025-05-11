from app.notification.client import send_discord_webhook
from app.models.user import UserResponse
from app.utils.system import readable_size
from app.models.settings import NotificationSettings
from app.settings import notification_settings
from . import colors

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


async def user_status_change(user: UserResponse, by: str):
    data = {
        "content": "",
        "embeds": [
            {
                "title": _status[user.status.value],
                "description": f"**Username:** {user.username}\n",
                "color": _status_color[user.status.value],
                "footer": {"text": f"Belongs To:{user.admin.username if user.admin else None}\nBy: {by}"},
            }
        ],
    }
    settings: NotificationSettings = await notification_settings()
    if settings.notify_discord:
        await send_discord_webhook(data, settings.discord_webhook_url)
    if user.admin and user.admin.discord_webhook:
        await send_discord_webhook(data, user.admin.discord_webhook)


async def create_user(user: UserResponse, by: str):
    data = {
        "content": "",
        "embeds": [
            {
                "title": "🆕 Create User",
                "description": f"**Username:** {user.username}\n"
                + f"**Data Limit**: {readable_size(user.data_limit) if user.data_limit else 'Unlimited'}\n"
                + f"**Expire Date:** {user.expire if user.expire else 'Never'}\n"
                + f"**Data Limit Reset Strategy:** {user.data_limit_reset_strategy.value}\n"
                + f"**Has Next Plan**: {bool(user.next_plan)}",
                "color": colors.GREEN,
                "footer": {"text": f"Belongs To:{user.admin.username if user.admin else None}\nBy: {by}"},
            }
        ],
    }
    settings: NotificationSettings = await notification_settings()
    if settings.notify_discord:
        await send_discord_webhook(data, settings.discord_webhook_url)
    if user.admin and user.admin.discord_webhook:
        await send_discord_webhook(data, user.admin.discord_webhook)


async def modify_user(user: UserResponse, by: str):
    data = {
        "content": "",
        "embeds": [
            {
                "title": "✏️ Modify User",
                "description": f"**Username:** {user.username}\n"
                + f"**Data Limit**: {readable_size(user.data_limit) if user.data_limit else 'Unlimited'}\n"
                + f"**Expire Date:** {user.expire if user.expire else 'Never'}\n"
                + f"**Data Limit Reset Strategy:** {user.data_limit_reset_strategy.value}\n"
                + f"**Has Next Plan**: {bool(user.next_plan)}",
                "color": colors.YELLOW,
                "footer": {"text": f"Belongs To:{user.admin.username if user.admin else None}\nBy: {by}"},
            }
        ],
    }
    settings: NotificationSettings = await notification_settings()
    if settings.notify_discord:
        await send_discord_webhook(data, settings.discord_webhook_url)
    if user.admin and user.admin.discord_webhook:
        await send_discord_webhook(data, user.admin.discord_webhook)


async def remove_user(user: UserResponse, by: str):
    data = {
        "content": "",
        "embeds": [
            {
                "title": "🗑️ Remove User",
                "description": f"**Username:** {user.username}\n",
                "color": colors.RED,
                "footer": {
                    "text": f"ID: {user.id}\nBelongs To:{user.admin.username if user.admin else None}\nBy: {by}"
                },
            }
        ],
    }
    settings: NotificationSettings = await notification_settings()
    if settings.notify_discord:
        await send_discord_webhook(data, settings.discord_webhook_url)
    if user.admin and user.admin.discord_webhook:
        await send_discord_webhook(data, user.admin.discord_webhook)


async def reset_user_data_usage(user: UserResponse, by: str):
    data = {
        "content": "",
        "embeds": [
            {
                "title": "🔁 Reset User Data Usage",
                "description": f"**Username:** {user.username}\n"
                + f"**Data Limit**: {readable_size(user.data_limit) if user.data_limit else 'Unlimited'}\n",
                "color": colors.CYAN,
                "footer": {
                    "text": f"ID: {user.id}\nBelongs To:{user.admin.username if user.admin else None}\nBy: {by}"
                },
            }
        ],
    }
    settings: NotificationSettings = await notification_settings()
    if settings.notify_discord:
        await send_discord_webhook(data, settings.discord_webhook_url)
    if user.admin and user.admin.discord_webhook:
        await send_discord_webhook(data, user.admin.discord_webhook)


async def user_data_reset_by_next(user: UserResponse, by: str):
    data = {
        "content": "",
        "embeds": [
            {
                "title": "🔁 Reset User",
                "description": f"**Username:** {user.username}\n"
                + f"**Data Limit**: {readable_size(user.data_limit) if user.data_limit else 'Unlimited'}\n"
                + f"**Expire Date:** {user.expire if user.expire else 'Never'}",
                "color": colors.CYAN,
                "footer": {
                    "text": f"ID: {user.id}\nBelongs To:{user.admin.username if user.admin else None}\nBy: {by}"
                },
            }
        ],
    }
    settings: NotificationSettings = await notification_settings()
    if settings.notify_discord:
        await send_discord_webhook(data, settings.discord_webhook_url)
    if user.admin and user.admin.discord_webhook:
        await send_discord_webhook(data, user.admin.discord_webhook)


async def user_subscription_revoked(user: UserResponse, by: str):
    data = {
        "content": "",
        "embeds": [
            {
                "title": "🛑 Revoke User Subscribtion",
                "description": f"**Username:** {user.username}\n",
                "color": colors.RED,
                "footer": {
                    "text": f"ID: {user.id}\nBelongs To:{user.admin.username if user.admin else None}\nBy: {by}"
                },
            }
        ],
    }
    settings: NotificationSettings = await notification_settings()
    if settings.notify_discord:
        await send_discord_webhook(data, settings.discord_webhook_url)
    if user.admin and user.admin.discord_webhook:
        await send_discord_webhook(data, user.admin.discord_webhook)

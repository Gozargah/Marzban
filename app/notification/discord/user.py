from app.notification.client import send_discord_webhook
from config import DISCORD_WEBHOOK_URL
from app.models.user import UserResponse

_status = {
    "active": "**✅ Activated**",
    "disabled": "**❌ Disabled**",
    "limited": "**🪫 Limited**",
    "expired": "**🕔 Expired**",
}
_status_color = {"active": 0x9AE6B4, "disabled": 0x424B59, "limited": 0xF8A7A8, "expired": 0xFBD38D}


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
    if DISCORD_WEBHOOK_URL:
        await send_discord_webhook(data, DISCORD_WEBHOOK_URL)
    if user.admin and user.admin.discord_webhook:
        await send_discord_webhook(data, user.admin.discord_webhook)


async def create_user(user: UserResponse, by: str):
    data = {
        "content": "",
        "embeds": [
            {
                "title": "🆕 Create User",
                "description": f"**Username:** {user.username}\n"
                + f"**Data Limit**: {user.data_limit}"
                + f"**Expire Date:** {user.expire}"
                + f"**Data Limit Reset Strategy:** {user.data_limit_reset_strategy.value}"
                + f"**Has Next Plan**: {bool(user.next_plan)}",
                "color": 0x00FF00,
                "footer": {"text": f"Belongs To:{user.admin.username if user.admin else None}\nBy: {by}"},
            }
        ],
    }
    if DISCORD_WEBHOOK_URL:
        await send_discord_webhook(data, DISCORD_WEBHOOK_URL)
    if user.admin and user.admin.discord_webhook:
        await send_discord_webhook(data, user.admin.discord_webhook)


async def modify_user(user: UserResponse, by: str):
    data = {
        "content": "",
        "embeds": [
            {
                "title": "✏️ Modify User",
                "description": f"**Username:** {user.username}\n"
                + f"**Data Limit**: {user.data_limit}"
                + f"**Expire Date:** {user.expire}"
                + f"**Data Limit Reset Strategy:** {user.data_limit_reset_strategy.value}"
                + f"**Has Next Plan**: {bool(user.next_plan)}",
                "color": 0xFFFF00,
                "footer": {"text": f"Belongs To:{user.admin.username if user.admin else None}\nBy: {by}"},
            }
        ],
    }
    if DISCORD_WEBHOOK_URL:
        await send_discord_webhook(data, DISCORD_WEBHOOK_URL)
    if user.admin and user.admin.discord_webhook:
        await send_discord_webhook(data, user.admin.discord_webhook)


async def remove_user(user: UserResponse, by: str):
    data = {
        "content": "",
        "embeds": [
            {
                "title": "🗑️ Remove User",
                "description": f"**Username:** {user.username}\n",
                "color": 0xFF0000,
                "footer": {
                    "text": f"ID: {user.id}\nBelongs To:{user.admin.username if user.admin else None}\nBy: {by}"
                },
            }
        ],
    }
    if DISCORD_WEBHOOK_URL:
        await send_discord_webhook(data, DISCORD_WEBHOOK_URL)
    if user.admin and user.admin.discord_webhook:
        await send_discord_webhook(data, user.admin.discord_webhook)


async def reset_user_data_usage(user: UserResponse, by: str):
    data = {
        "content": "",
        "embeds": [
            {
                "title": "🔁 Reset User Data Usage",
                "description": f"**Username:** {user.username}\n",
                "color": 0x00FFFF,
                "footer": {
                    "text": f"ID: {user.id}\nBelongs To:{user.admin.username if user.admin else None}\nBy: {by}"
                },
            }
        ],
    }
    if DISCORD_WEBHOOK_URL:
        await send_discord_webhook(data, DISCORD_WEBHOOK_URL)
    if user.admin and user.admin.discord_webhook:
        await send_discord_webhook(data, user.admin.discord_webhook)


async def user_data_reset_by_next(user: UserResponse, by: str):
    data = {
        "content": "",
        "embeds": [
            {
                "title": "🔁 Reset User",
                "description": f"**Username:** {user.username}\n"
                + f"**Data Limit:** {user.data_limit}"
                + f"**Expire Date:** {user.expire}",
                "color": 0x00FFFF,
                "footer": {
                    "text": f"ID: {user.id}\nBelongs To:{user.admin.username if user.admin else None}\nBy: {by}"
                },
            }
        ],
    }
    if DISCORD_WEBHOOK_URL:
        await send_discord_webhook(data, DISCORD_WEBHOOK_URL)
    if user.admin and user.admin.discord_webhook:
        await send_discord_webhook(data, user.admin.discord_webhook)


async def user_subscription_revoked(user: UserResponse, by: str):
    data = {
        "content": "",
        "embeds": [
            {
                "title": "🛑 Revoke User Subscribtion",
                "description": f"**Username:** {user.username}\n",
                "color": 0xFF0000,
                "footer": {
                    "text": f"ID: {user.id}\nBelongs To:{user.admin.username if user.admin else None}\nBy: {by}"
                },
            }
        ],
    }
    if DISCORD_WEBHOOK_URL:
        await send_discord_webhook(data, DISCORD_WEBHOOK_URL)
    if user.admin and user.admin.discord_webhook:
        await send_discord_webhook(data, user.admin.discord_webhook)

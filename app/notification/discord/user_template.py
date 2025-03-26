from app.notification.client import send_discord_webhook
from config import DISCORD_WEBHOOK_URL
from app.models.user_template import UserTemplateResponse
from . import colors


async def create_user_template(user_tempelate: UserTemplateResponse, by: str):
    data = {
        "content": "",
        "embeds": [
            {
                "title": "Create User Template",
                "description": f"**Name:** {user_tempelate.name}\n"
                + f"**Data Limit**: {user_tempelate.data_limit}\n"
                + f"**Expire Duration**: {user_tempelate.expire_duration}\n"
                + f"**Username Prefix**: {user_tempelate.username_prefix}\n"
                + f"**Username Suffix**: {user_tempelate.username_suffix}\n",
                "color": colors.GREEN,
                "footer": {"text": f"By: {by}"},
            }
        ],
    }
    if DISCORD_WEBHOOK_URL:
        await send_discord_webhook(data, DISCORD_WEBHOOK_URL)


async def modify_user_template(user_template: UserTemplateResponse, by: str):
    data = {
        "content": "",
        "embeds": [
            {
                "title": "Modify User Template",
                "description": f"**Name:** {user_template.name}\n"
                + f"**Data Limit**: {user_template.data_limit}\n"
                + f"**Expire Duration**: {user_template.expire_duration}\n"
                + f"**Username Prefix**: {user_template.username_prefix}\n"
                + f"**Username Suffix**: {user_template.username_suffix}\n",
                "color": colors.YELLOW,
                "footer": {"text": f"By: {by}"},
            }
        ],
    }
    if DISCORD_WEBHOOK_URL:
        await send_discord_webhook(data, DISCORD_WEBHOOK_URL)


async def remove_user_template(name: str, by: str):
    data = {
        "content": "",
        "embeds": [
            {
                "title": "Remove User Template",
                "description": f"**Name:** {name}\n",
                "color": colors.RED,
                "footer": {"text": f"By: {by}"},
            }
        ],
    }
    if DISCORD_WEBHOOK_URL:
        await send_discord_webhook(data, DISCORD_WEBHOOK_URL)

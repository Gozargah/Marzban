from config import DISCORD_WEBHOOK_URL
from app.notification.client import send_discord_webhook
from app.models.core import CoreResponse
from . import colors


async def create_core(core: CoreResponse, by: str):
    data = {
        "content": "",
        "embeds": [
            {
                "title": "Create core",
                "description": f"**Name:** {core.name}\n"
                + f"**Exclude inbound tags:** {core.exclude_inbound_tags}\n"
                + f"**Fallbacks inbound tags:** {core.fallbacks_inbound_tags}\n",
                "color": colors.GREEN,
                "footer": {"text": f"ID: {core.id}\nBy: {by}"},
            }
        ],
    }
    if DISCORD_WEBHOOK_URL:
        await send_discord_webhook(data, DISCORD_WEBHOOK_URL)


async def modify_core(core: CoreResponse, by: str):
    data = {
        "content": "",
        "embeds": [
            {
                "title": "Modify core",
                "description": f"**Name:** {core.name}\n"
                + f"**Exclude inbound tags:** {core.exclude_inbound_tags}\n"
                + f"**Fallbacks inbound tags:** {core.fallbacks_inbound_tags}\n",
                "color": colors.YELLOW,
                "footer": {"text": f"ID: {core.id}\nBy: {by}"},
            }
        ],
    }
    if DISCORD_WEBHOOK_URL:
        await send_discord_webhook(data, DISCORD_WEBHOOK_URL)


async def remove_core(core_id: int, by: str):
    data = {
        "content": "",
        "embeds": [
            {
                "title": "Remove core",
                "description": f"**ID:** {core_id}",
                "color": colors.RED,
                "footer": {"text": f"By: {by}"},
            }
        ],
    }
    if DISCORD_WEBHOOK_URL:
        await send_discord_webhook(data, DISCORD_WEBHOOK_URL)

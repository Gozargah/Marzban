from app.notification.client import send_discord_webhook
from config import DISCORD_WEBHOOK_URL
from app.models.host import BaseHost


async def add_host(host: BaseHost, by: str):
    data = {
        "content": "",
        "embeds": [
            {
                "title": "Add Host",
                "description": f"**Remark:** {host.remark}\n"
                + f"**Address:** {host.address}\n"
                + f"**Inbound Tag:** {host.inbound_tag}\n"
                + f"**Port:** {host.port}",
                "color": int("00ff00", 16),
                "footer": {"text": f"ID: {host.id}\nBy: {by}"},
            }
        ],
    }
    if DISCORD_WEBHOOK_URL:
        await send_discord_webhook(data, DISCORD_WEBHOOK_URL)


async def modify_host(host: BaseHost, by: str):
    data = {
        "content": "",
        "embeds": [
            {
                "title": "Modify Host",
                "description": f"**Remark:** {host.remark}\n"
                + f"**Address:** {host.address}\n"
                + f"**Inbound Tag:** {host.inbound_tag}\n"
                + f"**Port:** {host.port}",
                "color": int("ffff00", 16),
                "footer": {"text": f"ID: {host.id}\nBy: {by}"},
            }
        ],
    }
    if DISCORD_WEBHOOK_URL:
        await send_discord_webhook(data, DISCORD_WEBHOOK_URL)


async def remove_host(host: BaseHost, by: str):
    data = {
        "content": "",
        "embeds": [
            {
                "title": "Remove Host",
                "description": f"**Remark:** {host.remark}",
                "color": int("ff0000", 16),
                "footer": {"text": f"ID: {host.id}\nBy: {by}"},
            }
        ],
    }
    if DISCORD_WEBHOOK_URL:
        await send_discord_webhook(data, DISCORD_WEBHOOK_URL)


async def update_hosts(by: str):
    data = {
        "content": "",
        "embeds": [
            {
                "title": "Update Hosts",
                "description": f"All hosts has been updated by **{by}**",
                "color": int("00ffff", 16),
            }
        ],
    }
    if DISCORD_WEBHOOK_URL:
        await send_discord_webhook(data, DISCORD_WEBHOOK_URL)

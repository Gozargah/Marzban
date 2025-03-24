from app.notification.client import send_discord_webhook
from config import DISCORD_WEBHOOK_URL
from app.models.node import NodeResponse


async def add_node(node: NodeResponse, by: str):
    data = {
        "content": "",
        "embeds": [
            {
                "title": "Add Node",
                "description": f"**Name:** {node.name}\n" + f"**Address:** {node.address}\n" + f"**Port:** {node.port}",
                "color": int("00ff00", 16),
                "footer": {"text": f"ID: {node.id}\nBy: {by}"},
            }
        ],
    }
    if DISCORD_WEBHOOK_URL:
        await send_discord_webhook(data, DISCORD_WEBHOOK_URL)


async def modify_node(node: NodeResponse, by: str):
    data = {
        "content": "",
        "embeds": [
            {
                "title": "Modify Node",
                "description": f"**Name:** {node.name}\n" + f"**Address:** {node.address}\n" + f"**Port:** {node.port}",
                "color": int("ffff00", 16),
                "footer": {"text": f"ID: {node.id}\nBy: {by}"},
            }
        ],
    }
    if DISCORD_WEBHOOK_URL:
        await send_discord_webhook(data, DISCORD_WEBHOOK_URL)


async def remove_node(node: NodeResponse, by: str):
    data = {
        "content": "",
        "embeds": [
            {
                "title": "Remove Node",
                "description": f"**Name:** {node.name}\n" + f"**Address:** {node.address}\n" + f"**Port:** {node.port}",
                "color": int("ff0000", 16),
                "footer": {"text": f"ID: {node.id}\nBy: {by}"},
            }
        ],
    }
    if DISCORD_WEBHOOK_URL:
        await send_discord_webhook(data, DISCORD_WEBHOOK_URL)

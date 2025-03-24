from app.notification.client import send_telegram_message
from app.models.node import NodeResponse
from config import TELEGRAM_LOGGER_TOPIC_ID, TELEGRAM_LOGGER_CHANNEL_ID, TELEGRAM_ADMIN_ID, TELEGRAM_NOTIFY


async def add_node(node: NodeResponse, by: str):
    data = (
        "*Add Node*\n"
        + "➖➖➖➖➖➖➖➖➖\n"
        + f"**ID:** {node.id}\n"
        + f"**Name:** {node.name}\n"
        + f"**Address:** {node.address}\n"
        + f"**Port:** {node.port}\n"
        + "➖➖➖➖➖➖➖➖➖\n"
        + f"_By: {by}_"
    )
    if TELEGRAM_NOTIFY:
        await send_telegram_message(data, TELEGRAM_ADMIN_ID, TELEGRAM_LOGGER_CHANNEL_ID, TELEGRAM_LOGGER_TOPIC_ID)


async def modify_node(node: NodeResponse, by: str):
    data = (
        "*Modify Node*\n"
        + "➖➖➖➖➖➖➖➖➖\n"
        + f"**ID:** {node.id}\n"
        + f"**Name:** {node.name}\n"
        + f"**Address:** {node.address}\n"
        + f"**Port:** {node.port}\n"
        + "➖➖➖➖➖➖➖➖➖\n"
        + f"_By: {by}_"
    )
    if TELEGRAM_NOTIFY:
        await send_telegram_message(data, TELEGRAM_ADMIN_ID, TELEGRAM_LOGGER_CHANNEL_ID, TELEGRAM_LOGGER_TOPIC_ID)


async def remove_node(node: NodeResponse, by: str):
    data = (
        "*Remove Node*\n"
        + "➖➖➖➖➖➖➖➖➖\n"
        + f"**ID:** {node.id}\n"
        + f"**Name:** {node.name}\n"
        + "➖➖➖➖➖➖➖➖➖\n"
        + f"_By: {by}_"
    )
    if TELEGRAM_NOTIFY:
        await send_telegram_message(data, TELEGRAM_ADMIN_ID, TELEGRAM_LOGGER_CHANNEL_ID, TELEGRAM_LOGGER_TOPIC_ID)

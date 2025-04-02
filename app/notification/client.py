import httpx
import asyncio

from app.utils.logger import get_logger
from config import TELEGRAM_API_TOKEN, NOTIFICATION_PROXY_URL


client = httpx.AsyncClient(
    http2=True,
    timeout=httpx.Timeout(10),
    proxy=NOTIFICATION_PROXY_URL,
)

logger = get_logger("Notification")


async def send_discord_webhook(json_data, webhook):
    _not_done = True
    while _not_done:
        try:
            response = await client.post(webhook, json=json_data)
            if response.status_code in [200, 204]:
                logger.debug(f"Discord webhook payload delivered successfully, code {response.status_code}.")
                _not_done = False
            elif response.status_code == 429:
                asyncio.sleep(0.5)
                continue
            else:
                response_text = response.text
                logger.error(f"Discord webhook failed: {response.status_code} - {response_text}")
        except Exception as err:
            logger.error(f"Discord webhook failed Exception: {str(err)}")


async def send_telegram_message(message, chat_id=0, channel_id=0, topic_id=0):
    """
    Send a message to Telegram based on the available IDs.
    Args:
        message (str): The message to send
        chat_id (str, optional): The chat ID for direct messages
        channel_id (str, optional): The channel ID for channel messages
        topic_id (int, optional): The topic ID for forum topics in channels
    Returns:
        bool: True if message was sent successfully, False otherwise
    """
    # Ensure TELEGRAM_API_TOKEN is available
    try:
        TELEGRAM_API_TOKEN
    except NameError:
        logger.error("TELEGRAM_API_TOKEN is not defined")
        return

    base_url = f"https://api.telegram.org/bot{TELEGRAM_API_TOKEN}/sendMessage"
    payload = {"parse_mode": "Markdown", "text": message}

    # Determine the target chat/channel/topic
    if topic_id != 0 and channel_id != 0:
        payload["chat_id"] = channel_id
        payload["message_thread_id"] = topic_id
    elif channel_id != 0:
        payload["chat_id"] = channel_id
    elif chat_id != 0:
        payload["chat_id"] = chat_id
    else:
        logger.error("At least one of chat_id, channel_id must be provided")
        return

    _not_done = True
    while _not_done:
        try:
            response = await client.post(base_url, data=payload)
            if response.status_code == 200:
                logger.debug(f"Telegram message sent successfully, code {response.status_code}.")
                _not_done = False
            elif response.status_code == 429:
                asyncio.sleep(0.5)
                continue
            else:
                # Correctly access the text property without parentheses
                response_text = response.text
                logger.error(f"Telegram message failed: {response.status_code} - {response_text}")
        except Exception as err:
            logger.error(f"Telegram message failed: {str(err)}")
            return

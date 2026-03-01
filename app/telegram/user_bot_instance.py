"""
Singleton TeleBot instance for the user-facing bot.

Imported by both the handler module and the telegram __init__ bootstrap,
keeping them decoupled and avoiding circular imports.
"""
from config import TELEGRAM_PROXY_URL, TELEGRAM_USER_BOT_TOKEN
from telebot import TeleBot, apihelper

user_bot: TeleBot | None = None

if TELEGRAM_USER_BOT_TOKEN:
    if TELEGRAM_PROXY_URL:
        apihelper.proxy = {"http": TELEGRAM_PROXY_URL, "https": TELEGRAM_PROXY_URL}
    user_bot = TeleBot(TELEGRAM_USER_BOT_TOKEN)

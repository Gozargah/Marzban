import glob
import importlib.util
from os.path import basename, dirname, join
from threading import Thread
from config import TELEGRAM_API_TOKEN, TELEGRAM_PROXY_URL
from app import app
from telebot import TeleBot, apihelper


bot = None
if TELEGRAM_API_TOKEN:
    apihelper.proxy = {'http': TELEGRAM_PROXY_URL, 'https': TELEGRAM_PROXY_URL}
    bot = TeleBot(TELEGRAM_API_TOKEN)


@app.on_event("startup")
def start_bot():
    if bot:
        handler = glob.glob(join(dirname(__file__), "*.py"))
        for file in handler:
            name = basename(file).replace('.py', '')
            if name.startswith('_'):
                continue
            spec = importlib.util.spec_from_file_location(name, file)
            spec.loader.exec_module(importlib.util.module_from_spec(spec))

        thread = Thread(target=bot.infinity_polling, daemon=True)
        thread.start()


from .report import (  # noqa
    report,
    report_new_user,
    report_user_modification,
    report_user_deletion,
    report_status_change
)

__all__ = [
    "bot",
    "report",
    "report_new_user",
    "report_user_modification",
    "report_user_deletion",
    "report_status_change"
]

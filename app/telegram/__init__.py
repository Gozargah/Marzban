import importlib.util
import time
from os.path import dirname
from pathlib import Path
from threading import Thread

from telebot import TeleBot, apihelper

from app import app, settings
from config import TELEGRAM_PROXY_URL


class TelegramBot(TeleBot):
    def __init__(self, *args, **kwargs):
        apihelper.proxy = {'http': TELEGRAM_PROXY_URL, 'https': TELEGRAM_PROXY_URL}
        super().__init__(settings.get('telegram_api_token'), *args, **kwargs)
        self.__polling_thread = None
        self.is_stopping = False

    @property
    def is_running(self):
        return bool(self.__polling_thread and self.__polling_thread.is_alive())

    def start(self):
        if self.is_running:
            raise RuntimeError('Bot is running')

        if self.token != settings.get('telegram_api_token'):
            self.token = settings.get('telegram_api_token')

        if not self.token:
            return

        self.__polling_thread = Thread(target=bot.infinity_polling, daemon=True)
        self.__polling_thread.start()

        return True

    def stop(self):
        if not self.is_running:
            return

        if self.is_stopping:
            return

        if self.__polling_thread:
            self.stop_polling()
            self.is_stopping = True
            while self.is_running:
                time.sleep(0.25)
            self.is_stopping = False
            self._TeleBot__stop_polling.clear()
            return True

    def restart(self):
        if bot.stop():
            bot.start()


bot = TelegramBot()

from app.telegram import utils  # noqa - setup custom handlers

utils.setup()

handler_dir = dirname(__file__) + "/handlers/"
for handler in Path(handler_dir).glob("*.py"):
    spec = importlib.util.spec_from_file_location(handler.name[:-3], handler)
    spec.loader.exec_module(importlib.util.module_from_spec(spec))


@app.on_event("startup")
def start_bot_at_startup():
    bot.start()


from .handlers.report import (report, report_new_user,  # noqa
                              report_status_change, report_user_deletion,
                              report_user_modification,
                              report_user_subscription_revoked,
                              report_user_usage_reset)

__all__ = [
    "bot",
    "report",
    "report_new_user",
    "report_user_modification",
    "report_user_deletion",
    "report_status_change",
    "report_user_usage_reset",
    "report_user_subscription_revoked"
]

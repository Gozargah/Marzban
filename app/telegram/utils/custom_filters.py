from app.telegram import bot

from telebot import types
from telebot.custom_filters import AdvancedCustomFilter

from config import TELEGRAM_ADMIN_ID


class IsAdminFilter(AdvancedCustomFilter):
    key = 'is_admin'

    def check(self, message, text):
        """
        :meta private:
        """
        if isinstance(message, types.CallbackQuery):
            return message.from_user.id in TELEGRAM_ADMIN_ID
        return message.chat.id in TELEGRAM_ADMIN_ID


def cb_query_equals(text: str):
    return lambda query: query.data == text


def cb_query_startswith(text: str):
    return lambda query: query.data.startswith(text)



def setup() -> None:
    bot.add_custom_filter(IsAdminFilter())
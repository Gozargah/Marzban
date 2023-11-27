from telebot import types
from telebot.custom_filters import AdvancedCustomFilter, ChatFilter

from app import settings
from app.telegram import bot


class IsAdminFilter(AdvancedCustomFilter):
    key = 'is_admin'

    def check(self, message, text):
        """
        :meta private:
        """
        if isinstance(message, types.CallbackQuery):
            return message.from_user.id in settings['telegram_admins']
        return message.chat.id in settings['telegram_admins']


def cb_query_equals(text: str):
    return lambda query: query.data == text


def cb_query_startswith(text: str):
    return lambda query: query.data.startswith(text)


def setup() -> None:
    bot.add_custom_filter(IsAdminFilter())
    bot.add_custom_filter(ChatFilter())

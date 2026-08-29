from app.telegram import bot

from telebot import types
from telebot.custom_filters import AdvancedCustomFilter

from config import TELEGRAM_ADMIN_ID


def is_admin_chat(update) -> bool:
    """Whether this update is an admin talking to the bot in their own chat.

    Both halves matter, and the two branches used to disagree about them.
    A message was checked by `chat.id`, which in a private chat is the other
    party's user id — so it happened to mean "an admin, in private", but only
    as a side effect. A callback query was checked by `from_user.id` alone,
    which does not: the bot posts keyboards into the logger channel, and a
    button pressed on one of those would be answered wherever it was pressed,
    with the panel's output going to everyone in that chat.

    So both are asked the same two questions now. The sender has to be an
    admin, and the conversation has to be that admin's own private chat with
    the bot — the one place where nobody else can read the reply. Handlers
    answer into `chat.id`, which is what makes the second question part of
    the access check rather than a nicety.
    """
    message = update.message if isinstance(update, types.CallbackQuery) else update

    sender = getattr(update, "from_user", None)
    chat = getattr(message, "chat", None)
    if sender is None or chat is None:
        return False

    return (
        sender.id in TELEGRAM_ADMIN_ID
        and chat.type == "private"
        and chat.id == sender.id
    )


class IsAdminFilter(AdvancedCustomFilter):
    key = 'is_admin'

    def check(self, message, text):
        """
        :meta private:
        """
        return is_admin_chat(message)


def cb_query_equals(text: str):
    return lambda query: query.data == text


def cb_query_startswith(text: str):
    return lambda query: query.data.startswith(text)


def setup() -> None:
    bot.add_custom_filter(IsAdminFilter())

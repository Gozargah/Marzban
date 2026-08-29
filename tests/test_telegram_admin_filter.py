"""Who the Telegram bot takes orders from.

The bot's handlers answer into the chat the update came from, so the access
check has to cover both the sender and the chat. The two branches of the
filter used to disagree: a message was checked by `chat.id`, which in a
private chat happens to be the other party's user id, while a callback query
was checked by `from_user.id` alone and so was answered wherever the button
was pressed.
"""

import pytest

from telebot import types

from app.telegram.utils import custom_filters
from app.telegram.utils.custom_filters import is_admin_chat

ADMIN_ID = 111
STRANGER_ID = 222
GROUP_ID = -1001234567890


@pytest.fixture(autouse=True)
def admins(monkeypatch):
    monkeypatch.setattr(custom_filters, "TELEGRAM_ADMIN_ID", [ADMIN_ID])


def user(user_id: int) -> types.User:
    return types.User(id=user_id, is_bot=False, first_name="Someone")


def chat(chat_id: int, chat_type: str) -> types.Chat:
    return types.Chat(id=chat_id, type=chat_type)


def message(sender_id: int, chat_id: int, chat_type: str = "private") -> types.Message:
    return types.Message(
        message_id=1,
        from_user=user(sender_id),
        date=0,
        chat=chat(chat_id, chat_type),
        content_type="text",
        options={},
        json_string="",
    )


def callback(presser_id: int, chat_id: int, chat_type: str = "private") -> types.CallbackQuery:
    return types.CallbackQuery(
        id="1",
        from_user=user(presser_id),
        data="system",
        chat_instance="x",
        json_string={},
        message=message(presser_id, chat_id, chat_type),
    )


class TestMessages:
    def test_an_admin_in_their_own_chat_is_allowed(self):
        assert is_admin_chat(message(ADMIN_ID, ADMIN_ID)) is True

    def test_a_stranger_is_refused(self):
        assert is_admin_chat(message(STRANGER_ID, STRANGER_ID)) is False

    def test_an_admin_in_a_group_is_refused(self):
        """The reply would go to the group, where everyone else can read it."""
        assert is_admin_chat(message(ADMIN_ID, GROUP_ID, "supergroup")) is False

    def test_a_stranger_writing_into_an_admins_chat_id_is_refused(self):
        """Belt and braces: the chat alone no longer decides."""
        assert is_admin_chat(message(STRANGER_ID, ADMIN_ID)) is False


class TestCallbackQueries:
    def test_an_admin_pressing_a_button_in_their_own_chat_is_allowed(self):
        assert is_admin_chat(callback(ADMIN_ID, ADMIN_ID)) is True

    def test_a_stranger_pressing_a_button_is_refused(self):
        assert is_admin_chat(callback(STRANGER_ID, STRANGER_ID)) is False

    def test_an_admin_pressing_a_button_in_a_group_is_refused(self):
        """It used to be allowed: the callback branch asked who pressed and
        never where, so the panel's output followed the button into the chat
        the bot had posted its keyboard to."""
        assert is_admin_chat(callback(ADMIN_ID, GROUP_ID, "supergroup")) is False


class TestMalformedUpdates:
    def test_an_update_without_a_sender_is_refused(self):
        anonymous = message(ADMIN_ID, ADMIN_ID)
        anonymous.from_user = None

        assert is_admin_chat(anonymous) is False

    def test_a_callback_without_a_message_is_refused(self):
        detached = callback(ADMIN_ID, ADMIN_ID)
        detached.message = None

        assert is_admin_chat(detached) is False


class TestFilterWiring:
    """The filter telebot actually calls has to go through the same check."""

    def test_the_filter_key_is_the_one_the_handlers_use(self):
        assert custom_filters.IsAdminFilter.key == "is_admin"

    @pytest.mark.parametrize(
        "update, allowed",
        [
            (message(ADMIN_ID, ADMIN_ID), True),
            (message(ADMIN_ID, GROUP_ID, "supergroup"), False),
            (callback(ADMIN_ID, ADMIN_ID), True),
            (callback(ADMIN_ID, GROUP_ID, "supergroup"), False),
        ],
    )
    def test_check_agrees_with_is_admin_chat(self, update, allowed):
        assert custom_filters.IsAdminFilter().check(update, True) is allowed

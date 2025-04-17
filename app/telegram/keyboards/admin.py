from enum import Enum
from aiogram.utils.keyboard import InlineKeyboardBuilder
from aiogram.filters.callback_data import CallbackData
from app.telegram.utils.texts import Button as Texts


class AdminPanelAction(str, Enum):
    create_user = "create-user"


class AdminPanel(InlineKeyboardBuilder):
    class Callback(CallbackData, prefix="panel"):
        action: AdminPanelAction

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self.button(text=Texts.create_user, callback_data=self.Callback(action=AdminPanelAction.create_user))
        self.adjust(1, 2)


class InlineQuerySearch(InlineKeyboardBuilder):
    def __init__(self, query: str,  *args, **kwargs):
        super().__init__(*args, **kwargs)
        self.button(text=Texts.search, switch_inline_query_current_chat=query)

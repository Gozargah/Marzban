from enum import Enum
from aiogram.utils.keyboard import InlineKeyboardBuilder
from aiogram.filters.callback_data import CallbackData
from app.telegram.utils.texts import Button as Texts


class AdminPanelAction(str, Enum):
    sync_users = "sync_users"
    refresh = "refresh"
    create_user = "create_user"



class AdminPanel(InlineKeyboardBuilder):
    class Callback(CallbackData, prefix="panel"):
        action: AdminPanelAction

    def __init__(self, is_sudo: bool = False, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self.button(text=Texts.refresh_data, callback_data=self.Callback(action=AdminPanelAction.refresh))
        if is_sudo:
            self.button(text=Texts.sync_users, callback_data=self.Callback(action=AdminPanelAction.sync_users))
        self.button(text=Texts.create_user, callback_data=self.Callback(action=AdminPanelAction.create_user))
        self.adjust(*([2, 1] if is_sudo else [1, 1]))


class InlineQuerySearch(InlineKeyboardBuilder):
    def __init__(self, query: str, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self.button(text=Texts.search, switch_inline_query_current_chat=query)

from enum import Enum

from aiogram.utils.keyboard import InlineKeyboardBuilder, WebAppInfo
from aiogram.filters.callback_data import CallbackData

from app.telegram.utils.texts import Button as Texts


class AdminPanelAction(str, Enum):
    sync_users = "sync_users"
    refresh = "refresh"
    create_user = "create_user"
    create_user_from_template = "create_user_from_template"
    bulk_actions = "bulk_actions"


class AdminPanel(InlineKeyboardBuilder):
    class Callback(CallbackData, prefix="panel"):
        action: AdminPanelAction

    def __init__(self, is_sudo: bool = False, panel_url: str = None, *args, **kwargs):
        super().__init__(*args, **kwargs)
        adjust = []
        if panel_url and panel_url.startswith("https://"):
            self.button(text=Texts.open_panel, web_app=WebAppInfo(url=panel_url))
            adjust.append(1)

        self.button(text=Texts.refresh_data, callback_data=self.Callback(action=AdminPanelAction.refresh))
        if is_sudo:
            self.button(text=Texts.sync_users, callback_data=self.Callback(action=AdminPanelAction.sync_users))
            self.button(text=Texts.users, switch_inline_query_current_chat="")
            self.button(text=Texts.bulk_actions, callback_data=self.Callback(action=AdminPanelAction.bulk_actions))
            adjust = adjust + [2] * 2
        else:
            self.button(text=Texts.users, switch_inline_query_current_chat="")
            adjust = adjust + [1] * 2
        self.button(text=Texts.create_user, callback_data=self.Callback(action=AdminPanelAction.create_user))
        self.button(
            text=Texts.create_user_from_template,
            callback_data=self.Callback(action=AdminPanelAction.create_user_from_template),
        )
        adjust = adjust + [1] * 2
        self.adjust(*adjust)


class InlineQuerySearch(InlineKeyboardBuilder):
    def __init__(self, query: str, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self.button(text=Texts.search, switch_inline_query_current_chat=query)

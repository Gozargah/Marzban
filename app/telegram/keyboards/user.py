from enum import Enum
from aiogram.utils.keyboard import InlineKeyboardBuilder
from aiogram.filters.callback_data import CallbackData

from app.models.user import UserResponse, UserStatus
from app.telegram.utils.texts import Button as Texts

from .confim_action import ConfirmAction

class UserPanelAction(str, Enum):
    show = "show"
    disable = "disable"
    enable = "enable"
    delete = "delete"
    revoke_sub = "revoke_sub"
    reset_usage = "reset_usage"
    activate_next_plan = "activate_next_plan"


class UserPanel(InlineKeyboardBuilder):
    class Callback(CallbackData, prefix="user"):
        username: str
        action: UserPanelAction = UserPanelAction.show

    def __init__(self, user: UserResponse, *args, **kwargs):
        super().__init__(*args, **kwargs)
        if user.status == UserStatus.active:
            self.button(
                text=Texts.disable,
                callback_data=ConfirmAction.Callback(
                    action=self.Callback(action=UserPanelAction.disable, username=user.username).pack(),
                    cancel=self.Callback(username=user.username).pack(),
                )
            )
        else:
            self.button(
                text=Texts.enable,
                callback_data=ConfirmAction.Callback(
                    action=self.Callback(action=UserPanelAction.enable, username=user.username).pack(),
                    cancel=self.Callback(username=user.username).pack(),
                )
            )
        self.button(
            text=Texts.delete,
            callback_data=ConfirmAction.Callback(
                action=self.Callback(action=UserPanelAction.delete, username=user.username).pack(),
                    cancel=self.Callback(username=user.username).pack(),
            )
        )
        self.button(
            text=Texts.revoke_sub,
            callback_data=ConfirmAction.Callback(
                action=self.Callback(action=UserPanelAction.revoke_sub, username=user.username).pack(),
                    cancel=self.Callback(username=user.username).pack(),
            )
        )
        self.button(
            text=Texts.reset_usage,
            callback_data=ConfirmAction.Callback(
                action=self.Callback(action=UserPanelAction.reset_usage, username=user.username).pack(),
                    cancel=self.Callback(username=user.username).pack(),
            )
        )
        if not user.next_plan:
            self.button(
                text=Texts.activate_next_plan,
                callback_data=ConfirmAction.Callback(
                    action=self.Callback(action=UserPanelAction.activate_next_plan, username=user.username).pack(),
                    cancel=self.Callback(username=user.username).pack(),
                )
            )

        self.adjust(2, repeat=True)

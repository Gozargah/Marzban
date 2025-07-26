from enum import Enum
from typing import List
from aiogram.utils.keyboard import InlineKeyboardBuilder
from aiogram.filters.callback_data import CallbackData

from app.models.user import UserResponse, UserStatus
from app.models.user_template import UserTemplate
from app.telegram.utils.texts import Button as Texts
from .base import CancelAction, CancelKeyboard

from .confim_action import ConfirmAction


class UserPanelAction(str, Enum):
    show = "show"
    disable = "disable"
    enable = "enable"
    delete = "delete"
    revoke_sub = "revoke_sub"
    reset_usage = "reset_usage"
    activate_next_plan = "activate_next_plan"
    modify_with_template = "modify_with_template"


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
                ),
            )
        else:
            self.button(
                text=Texts.enable,
                callback_data=ConfirmAction.Callback(
                    action=self.Callback(action=UserPanelAction.enable, username=user.username).pack(),
                    cancel=self.Callback(username=user.username).pack(),
                ),
            )
        self.button(
            text=Texts.delete,
            callback_data=ConfirmAction.Callback(
                action=self.Callback(action=UserPanelAction.delete, username=user.username).pack(),
                cancel=self.Callback(username=user.username).pack(),
            ),
        )
        self.button(
            text=Texts.revoke_sub,
            callback_data=ConfirmAction.Callback(
                action=self.Callback(action=UserPanelAction.revoke_sub, username=user.username).pack(),
                cancel=self.Callback(username=user.username).pack(),
            ),
        )
        self.button(
            text=Texts.reset_usage,
            callback_data=ConfirmAction.Callback(
                action=self.Callback(action=UserPanelAction.reset_usage, username=user.username).pack(),
                cancel=self.Callback(username=user.username).pack(),
            ),
        )
        if not user.next_plan:
            self.button(
                text=Texts.activate_next_plan,
                callback_data=ConfirmAction.Callback(
                    action=self.Callback(action=UserPanelAction.activate_next_plan, username=user.username).pack(),
                    cancel=self.Callback(username=user.username).pack(),
                ),
            )

        self.button(
            text=Texts.modify_with_template,
            callback_data=self.Callback(action=UserPanelAction.modify_with_template, username=user.username),
        )

        self.button(
            text=Texts.back,
            callback_data=CancelKeyboard.Callback(action=CancelAction.cancel),
        )

        self.adjust(2, 2, 1, 1, 1)


class ChooseStatus(InlineKeyboardBuilder):
    class Callback(CallbackData, prefix="user"):
        status: str

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self.button(text=Texts.on_hold, callback_data=self.Callback(status=UserStatus.on_hold.value))
        self.button(text=Texts.enable, callback_data=self.Callback(status=UserStatus.active.value))
        self.adjust(2, repeat=True)


class ChooseTemplate(InlineKeyboardBuilder):
    class Callback(CallbackData, prefix="choose_template"):
        template_id: int
        username: str = None  # in case choose template for modify

    def __init__(self, templates: List[UserTemplate], username: str = None, *args, **kwargs):
        super().__init__(*args, **kwargs)

        for template in templates:
            self.button(
                text=template.name,
                callback_data=self.Callback(template_id=template.id, username=username).pack(),
            )

        self.button(
            text=Texts.back,
            callback_data=CancelKeyboard.Callback(action=CancelAction.cancel),
        )
        self.adjust(1, repeat=True)

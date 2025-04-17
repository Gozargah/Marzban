from enum import StrEnum
from aiogram.utils.keyboard import InlineKeyboardBuilder
from aiogram.filters.callback_data import CallbackData


class CancelAction(StrEnum):
    cancel = "cancel"


class CancelKeyboard(InlineKeyboardBuilder):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self.button(text="❌ cancel", callback_data=self.Callback(action=CancelAction.cancel))
        self.adjust(1, 1)

    class Callback(CallbackData, prefix=""):
        action: CancelAction

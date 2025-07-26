from enum import Enum

from aiogram.utils.keyboard import InlineKeyboardBuilder
from aiogram.filters.callback_data import CallbackData

from app.telegram.keyboards.base import CancelKeyboard, CancelAction
from app.telegram.utils.texts import Button as Texts


class BulkAction(str, Enum):
    delete_expired = "delete_expired"
    modify_expiry = "modify_expiry"
    modify_data_limit = "modify_data_limit"


class BulkActionPanel(InlineKeyboardBuilder):
    class Callback(CallbackData, prefix="bulk"):
        action: BulkAction
        amount: str = ""

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)

        self.button(text=Texts.delete_expired, callback_data=self.Callback(action=BulkAction.delete_expired))
        self.button(text=Texts.modify_expiry, callback_data=self.Callback(action=BulkAction.modify_expiry))
        self.button(text=Texts.modify_data_limit, callback_data=self.Callback(action=BulkAction.modify_data_limit))

        self.button(
            text=Texts.back,
            callback_data=CancelKeyboard.Callback(action=CancelAction.cancel),
        )

        self.adjust(1, repeat=True)

from aiogram.utils.keyboard import InlineKeyboardBuilder
from aiogram.filters.callback_data import CallbackData

from app.telegram.utils.texts import Button as Texts


class ConfirmAction(InlineKeyboardBuilder):
    class Callback(CallbackData, prefix="confirm", sep="|"):
        action: str
        cancel: str

    def __init__(self, confirm_action: str, cancel_action: str, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self.button(text=Texts.confirm, callback_data=confirm_action)
        self.button(text=Texts.cancel, callback_data=cancel_action)
        self.adjust(2, repeat=True)

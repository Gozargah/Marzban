from aiogram import Router, F
from aiogram.filters import ExceptionTypeFilter
from aiogram.fsm.context import FSMContext
from aiogram.types import ErrorEvent
from aiogram.exceptions import TelegramAPIError
from pydantic import ValidationError

from app.utils.helpers import format_validation_error

router = Router(name="error_handler")


@router.error(ExceptionTypeFilter(ValueError, ValidationError), F.update.message | F.update.callback_query)
async def handle_exception(event: ErrorEvent, state: FSMContext = None):
    update = event.update

    if state:
        chat_id = update.callback_query.message.chat.id if update.callback_query else update.message.chat.id
        messages_to_delete = await state.get_value("messages_to_delete", [])
        try:
            await update.bot.delete_messages(chat_id, messages_to_delete)
        except TelegramAPIError:
            pass
        await state.clear()

    error = "❌ Error: "
    if isinstance(event.exception, ValidationError):
        error += format_validation_error(event.exception)
    else:
        error += str(event.exception)

    if update.message:
        msg = await update.message.answer(error)
        if state:
            await state.update_data(messages_to_delete=[msg.message_id])

    if update.callback_query:
        if len(error) > 200:
            error = error[:197] + "..."
        await update.callback_query.answer(error, show_alert=True)

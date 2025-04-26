from aiogram import Router, F
from aiogram.filters import ExceptionTypeFilter
from aiogram.types import ErrorEvent, Message, CallbackQuery
from pydantic import ValidationError

router = Router(name="error_handler")


@router.error(ExceptionTypeFilter(ValueError, ValidationError), F.update.message.as_("message"))
async def handle_message_exception(event: ErrorEvent, message: Message):
    error = "❌ Error: "
    if isinstance(event.exception, ValidationError):
        error += "\n".join(
            [e["loc"][0].replace("_", " ").capitalize() + ": " + e["msg"] for e in event.exception.errors()]
        )
    else:
        error += str(event.exception)
    await message.answer(error)


@router.error(ExceptionTypeFilter(ValueError, ValidationError), F.update.callback_query.as_("query"))
async def handle_query_exception(event: ErrorEvent, query: CallbackQuery):
    error = "❌ Error: "
    if isinstance(event.exception, ValidationError):
        error += "\n".join(
            [e["loc"][0].replace("_", " ").capitalize() + ": " + e["msg"] for e in event.exception.errors()]
        )
    else:
        error += str(event.exception)
    if len(error) > 200:
        error = error[:197] + "..."
    await query.answer(error, show_alert=True)

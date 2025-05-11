import math
from typing import List
from aiogram.exceptions import TelegramAPIError
from aiogram.fsm.context import FSMContext
from aiogram.types import CallbackQuery, Message


def readable_size(size_bytes: int):
    if int(size_bytes) == 0:
        return "0 Bytes"

    is_negative = False
    if size_bytes < 0:
        size_bytes = size_bytes * -1
        is_negative = True

    size_name = ("Bytes", "KB", "MB", "GB", "TB", "PT")
    i = int(math.floor(math.log(size_bytes, 1024)))
    s = round(size_bytes / (1024**i), 1)
    return f"{'-' if is_negative else ''}{int(s) if s.is_integer() else s} {size_name[i]}"


async def add_to_messages_to_delete(state: FSMContext, *messages: Message):
    messages_to_delete = await state.get_value("messages_to_delete", [])
    for message in messages:
        messages_to_delete.append(message.message_id)
    await state.update_data(messages_to_delete=messages_to_delete)


async def delete_messages(event: Message | CallbackQuery, state: FSMContext = None, message_ids: List[int] = None):
    message_ids = message_ids or []
    if state:
        message_ids += await state.get_value("messages_to_delete", [])

    chat_id = event.chat.id if isinstance(event, Message) else event.message.chat.id
    try:
        await event.bot.delete_messages(chat_id, message_ids)
    except TelegramAPIError:
        pass

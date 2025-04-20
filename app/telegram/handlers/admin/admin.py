from aiogram import types
from aiogram.filters import Command

from app.models.admin import AdminDetails
from app.telegram.utils.filters import IsAdminSUDO

from . import router


@router.message(IsAdminSUDO(), Command(commands=("admin")))
async def admin_panel(message: types.Message, admin: AdminDetails | None):
    await message.reply("hello admin")

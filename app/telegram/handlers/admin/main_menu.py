from aiogram import Router, F
from aiogram.exceptions import TelegramBadRequest
from aiogram.types import CallbackQuery
from sqlalchemy.ext.asyncio import AsyncSession

from app.operation import OperatorType
from app.operation.node import NodeOperation
from app.models.admin import AdminDetails
from app.operation.system import SystemOperation
from app.settings import telegram_settings
from app.telegram.utils.filters import IsAdminSUDO, IsAdminFilter
from app.telegram.keyboards.admin import AdminPanel, AdminPanelAction
from app.telegram.utils.texts import Message as Texts


system_operator = SystemOperation(OperatorType.TELEGRAM)
node_operator = NodeOperation(OperatorType.TELEGRAM)

router = Router(name="main_menu")


@router.callback_query(IsAdminFilter(), AdminPanel.Callback.filter(AdminPanelAction.refresh == F.action))
async def reload_data(event: CallbackQuery, db: AsyncSession, admin: AdminDetails):
    stats = await system_operator.get_system_stats(db, admin)
    try:
        settings = await telegram_settings()
        await event.message.edit_text(
            text=Texts.start(stats),
            reply_markup=AdminPanel(
                is_sudo=admin.is_sudo, panel_url=settings.mini_app_web_url if settings.mini_app_login else None
            ).as_markup(),
        )
    except TelegramBadRequest:
        pass

    await event.answer(Texts.refreshed)


@router.callback_query(IsAdminSUDO(), AdminPanel.Callback.filter(AdminPanelAction.sync_users == F.action))
async def sync_users(event: CallbackQuery, db: AsyncSession, admin: AdminDetails):
    await event.answer(Texts.syncing)
    for node in await node_operator.get_db_nodes(db):
        await node_operator.sync_node_users(db, node.id, flush_users=True)
    try:
        stats = await system_operator.get_system_stats(db, admin)
        settings = await telegram_settings()
        await event.message.edit_text(
            text=Texts.start(stats),
            reply_markup=AdminPanel(
                is_sudo=admin.is_sudo, panel_url=settings.mini_app_web_url if settings.mini_app_login else None
            ).as_markup(),
        )
    except TelegramBadRequest:
        pass

    await event.answer(Texts.synced)

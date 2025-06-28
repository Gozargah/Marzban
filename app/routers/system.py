from aiogram.types import Update
from fastapi import APIRouter, Depends, Header, HTTPException, Request
from fastapi.responses import JSONResponse

from app.db import AsyncSession, get_db
from app.models.admin import AdminDetails
from app.models.settings import Telegram
from app.models.system import SystemStats
from app.operation import OperatorType
from app.operation.system import SystemOperation
from app.settings import telegram_settings
from app.telegram import get_bot, get_dispatcher
from app.utils import responses
from app.utils.logger import EndpointFilter, get_logger

from .authentication import get_current

system_operator = SystemOperation(operator_type=OperatorType.API)
router = APIRouter(tags=["System"], prefix="/api", responses={401: responses._401})

TELEGRAM_WEBHOOK_PATH = "/tghook"
uvicorn_access_logger = get_logger("uvicorn.access")
uvicorn_access_logger.addFilter(EndpointFilter([f"{router.prefix}{TELEGRAM_WEBHOOK_PATH}"]))


@router.get("/system", response_model=SystemStats)
async def get_system_stats(
    admin_username: str | None = None, db: AsyncSession = Depends(get_db), admin: AdminDetails = Depends(get_current)
):
    """Fetch system stats including memory, CPU, and user metrics."""
    return await system_operator.get_system_stats(db, admin=admin, admin_username=admin_username)


@router.get("/inbounds", response_model=list[str])
async def get_inbounds(_: AdminDetails = Depends(get_current)):
    """Retrieve inbound configurations grouped by protocol."""
    return await system_operator.get_inbounds()


@router.post(TELEGRAM_WEBHOOK_PATH, include_in_schema=False)
async def webhook_handler(request: Request, X_Telegram_Bot_Api_Secret_Token: str = Header()):
    """Telegram webhook handler"""
    settings: Telegram = await telegram_settings()

    if not settings.enable:
        raise HTTPException(status_code=404, detail="not found")

    if X_Telegram_Bot_Api_Secret_Token != settings.webhook_secret:
        raise HTTPException(status_code=403, detail="Forbidden: Invalid secret key")

    bot = get_bot()
    dp = get_dispatcher()

    update_data = await request.json()
    update = Update.model_validate(update_data, context={"bot": bot})
    await dp.feed_update(bot, update)
    return JSONResponse(status_code=200, content={"status": "ok"})

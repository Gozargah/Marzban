from aiogram.types import Update
from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.responses import JSONResponse
from app.db import AsyncSession, get_db
from app.models.admin import AdminDetails
from app.models.system import SystemStats
from app.operation import OperatorType
from app.operation.system import SystemOperation
from app.telegram import bot, dp
from app.utils import responses
from app.utils.logger import EndpointFilter, get_logger
from config import TELEGRAM_API_TOKEN, TELEGRAM_WEBHOOK_SECRET_KEY
from .authentication import get_current

system_operator = SystemOperation(operator_type=OperatorType.API)
router = APIRouter(tags=["System"], prefix="/api", responses={401: responses._401})

TELEGRAN_WEBHOOK_PATH = f"/tghook/{TELEGRAM_API_TOKEN}"
uvicorn_access_logger = get_logger("uvicorn.access")
uvicorn_access_logger.addFilter(EndpointFilter([f"/api{TELEGRAN_WEBHOOK_PATH}"]))


@router.get("/system", response_model=SystemStats)
async def get_system_stats(db: AsyncSession = Depends(get_db), admin: AdminDetails = Depends(get_current)):
    """Fetch system stats including memory, CPU, and user metrics."""
    return await system_operator.get_system_stats(db, admin=admin)


@router.get("/inbounds", response_model=list[str])
async def get_inbounds(_: AdminDetails = Depends(get_current)):
    """Retrieve inbound configurations grouped by protocol."""
    return await system_operator.get_inbounds()


@router.post(TELEGRAN_WEBHOOK_PATH, include_in_schema=False)
async def webhook_handler(request: Request):
    """Telegram webhook handler"""

    if TELEGRAM_WEBHOOK_SECRET_KEY:
        secret_token = request.headers.get("X-Telegram-Bot-Api-Secret-Token")
        if secret_token != TELEGRAM_WEBHOOK_SECRET_KEY:
            raise HTTPException(status_code=403, detail="Forbidden: Invalid secret key")

    update_data = await request.json()
    update = Update.model_validate(update_data, context={"bot": bot})
    await dp.feed_update(bot, update)
    return JSONResponse(status_code=200, content={"status": "ok"})

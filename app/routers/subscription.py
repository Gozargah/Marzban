from datetime import datetime as dt

from fastapi import APIRouter, Depends, Header, Query, Request

from app.db import AsyncSession, get_db
from app.models.settings import ConfigFormat
from app.models.stats import Period, UserUsageStatsList
from app.models.user import SubscriptionUserResponse
from app.operation import OperatorType
from app.operation.subscription import SubscriptionOperation
from config import SUBSCRIPTION_PATH

router = APIRouter(tags=["Subscription"], prefix=f"/{SUBSCRIPTION_PATH}")
subscription_operator = SubscriptionOperation(operator_type=OperatorType.API)


@router.get("/{token}/")
@router.get("/{token}", include_in_schema=False)
async def user_subscription(
    request: Request,
    token: str,
    db: AsyncSession = Depends(get_db),
    user_agent: str = Header(default=""),
):
    """Provides a subscription link based on the user agent (Clash, V2Ray, etc.)."""
    return await subscription_operator.user_subscription(
        db,
        token=token,
        accept_header=request.headers.get("Accept", ""),
        user_agent=user_agent,
        request_url=str(request.url),
    )


@router.get("/{token}/info", response_model=SubscriptionUserResponse)
async def user_subscription_info(token: str, db: AsyncSession = Depends(get_db)):
    """Retrieves detailed information about the user's subscription."""
    return await subscription_operator.user_subscription_info(db, token=token)


@router.get("/{token}/usage", response_model=UserUsageStatsList)
async def get_sub_user_usage(
    token: str,
    start: dt | None = Query(None, example="2024-01-01T00:00:00+03:30"),
    end: dt | None = Query(None, example="2024-01-31T23:59:59+03:30"),
    period: Period = Period.hour,
    db: AsyncSession = Depends(get_db),
):
    """Fetches the usage statistics for the user within a specified date range."""
    return await subscription_operator.get_user_usage(db, token=token, start=start, end=end, period=period)


@router.get("/{token}/{client_type}")
async def user_subscription_with_client_type(
    request: Request,
    token: str,
    client_type: ConfigFormat,
    db: AsyncSession = Depends(get_db),
):
    """Provides a subscription link based on the specified client type (e.g., Clash, V2Ray)."""
    return await subscription_operator.user_subscription_with_client_type(
        db, token=token, client_type=client_type, request_url=str(request.url)
    )

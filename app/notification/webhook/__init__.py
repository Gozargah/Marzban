from datetime import datetime as dt, timezone as tz
from enum import Enum
from typing import Type
import asyncio

from pydantic import BaseModel

from app.settings import webhook_settings
from app.models.admin import AdminDetails
from app.models.user import UserResponse, UserStatus

queue = asyncio.Queue()


class Notification(BaseModel):
    class Type(str, Enum):
        user_created = "user_created"
        user_updated = "user_updated"
        user_deleted = "user_deleted"
        user_limited = "user_limited"
        user_expired = "user_expired"
        user_enabled = "user_enabled"
        user_disabled = "user_disabled"
        data_usage_reset = "data_usage_reset"
        data_reset_by_next = "data_reset_by_next"
        subscription_revoked = "subscription_revoked"

        reached_usage_percent = "reached_usage_percent"
        reached_days_left = "reached_days_left"

    enqueued_at: float = dt.now(tz.utc).timestamp()
    send_at: float = dt.now(tz.utc).timestamp()
    tries: int = 0


class UserNotification(Notification):
    username: str


class ReachedUsagePercent(UserNotification):
    action: Notification.Type = Notification.Type.reached_usage_percent
    user: UserResponse
    used_percent: float


class ReachedDaysLeft(UserNotification):
    action: Notification.Type = Notification.Type.reached_days_left
    user: UserResponse
    days_left: int


class UserCreated(UserNotification):
    action: Notification.Type = Notification.Type.user_created
    by: AdminDetails
    user: UserResponse


class UserUpdated(UserNotification):
    action: Notification.Type = Notification.Type.user_updated
    by: AdminDetails
    user: UserResponse


class UserDeleted(UserNotification):
    action: Notification.Type = Notification.Type.user_deleted
    by: AdminDetails


class UserLimited(UserNotification):
    action: Notification.Type = Notification.Type.user_limited
    user: UserResponse


class UserExpired(UserNotification):
    action: Notification.Type = Notification.Type.user_expired
    user: UserResponse


class UserEnabled(UserNotification):
    action: Notification.Type = Notification.Type.user_enabled
    by: AdminDetails | None = None
    user: UserResponse


class UserDisabled(UserNotification):
    action: Notification.Type = Notification.Type.user_disabled
    by: AdminDetails | None = None
    user: UserResponse
    reason: str | None = None


class UserDataUsageReset(UserNotification):
    action: Notification.Type = Notification.Type.data_usage_reset
    by: AdminDetails
    user: UserResponse


class UserDataResetByNext(UserNotification):
    action: Notification.Type = Notification.Type.data_usage_reset
    user: UserResponse


class UserSubscriptionRevoked(UserNotification):
    action: Notification.Type = Notification.Type.subscription_revoked
    by: AdminDetails
    user: UserResponse


async def status_change(user: UserResponse):
    if user.status == UserStatus.limited:
        await notify(UserLimited(username=user.username, user=user))
    elif user.status == UserStatus.expired:
        await notify(UserExpired(username=user.username, user=user))
    elif user.status == UserStatus.disabled:
        await notify(UserDisabled(username=user.username, user=user))
    elif user.status == UserStatus.active:
        await notify(UserEnabled(username=user.username, user=user))
    elif user.status == UserStatus.on_hold:
        await notify(UserEnabled(username=user.username, user=user))


async def notify(message: Type[Notification]) -> None:
    if (await webhook_settings()).enable:
        await queue.put(message)

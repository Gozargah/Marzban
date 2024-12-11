from collections import deque
from datetime import datetime as dt
from enum import Enum
from typing import Type

from pydantic import BaseModel

from config import WEBHOOK_ADDRESS
from app.models.admin import Admin
from app.models.user import UserResponse

queue = deque()


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

    enqueued_at: float = dt.utcnow().timestamp()
    send_at: float = dt.utcnow().timestamp()
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
    by: Admin
    user: UserResponse


class UserUpdated(UserNotification):
    action: Notification.Type = Notification.Type.user_updated
    by: Admin
    user: UserResponse


class UserDeleted(UserNotification):
    action: Notification.Type = Notification.Type.user_deleted
    by: Admin


class UserLimited(UserNotification):
    action: Notification.Type = Notification.Type.user_limited
    user: UserResponse


class UserExpired(UserNotification):
    action: Notification.Type = Notification.Type.user_expired
    user: UserResponse


class UserEnabled(UserNotification):
    action: Notification.Type = Notification.Type.user_enabled
    by: Admin | None = None
    user: UserResponse


class UserDisabled(UserNotification):
    action: Notification.Type = Notification.Type.user_disabled
    by: Admin
    user: UserResponse
    reason: str | None = None


class UserDataUsageReset(UserNotification):
    action: Notification.Type = Notification.Type.data_usage_reset
    by: Admin
    user: UserResponse


class UserDataResetByNext(UserNotification):
    action: Notification.Type = Notification.Type.data_usage_reset
    user: UserResponse


class UserSubscriptionRevoked(UserNotification):
    action: Notification.Type = Notification.Type.subscription_revoked
    by: Admin
    user: UserResponse


def notify(message: Type[Notification]) -> None:
    if WEBHOOK_ADDRESS:
        queue.append(message)

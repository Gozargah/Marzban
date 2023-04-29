from collections import deque
from datetime import datetime as dt
from enum import Enum
from typing import Type

from pydantic import BaseModel

import config
from app.models.admin import Admin
from app.models.user import UserResponse

queue = deque()


class ActionType(str, Enum):
    user_created = "user_created"
    user_updated = "user_updated"
    user_deleted = "user_deleted"
    user_limited = "user_limited"
    user_expired = "user_expired"
    user_enabled = "user_enabled"
    user_disabled = "user_disabled"

    reached_usage_percent = "reached_usage_percent"
    reached_days_left = "reached_days_left"


class Notification(BaseModel):
    enqueued_at: float = dt.utcnow().timestamp()
    send_at: float = dt.utcnow().timestamp()
    tries: int = 0


class UserNotification(Notification):
    username: str


class ReachedUsagePercent(UserNotification):
    action: ActionType = ActionType.reached_usage_percent
    user: UserResponse
    used_percent: float


class ReachedDaysLeft(UserNotification):
    action: ActionType = ActionType.reached_days_left
    user: UserResponse
    days_left: int


class UserCreated(UserNotification):
    action: ActionType = ActionType.user_created
    by: Admin
    user: UserResponse


class UserUpdated(UserNotification):
    action: ActionType = ActionType.user_updated
    by: Admin
    user: UserResponse


class UserDeleted(UserNotification):
    action: ActionType = ActionType.user_deleted
    by: Admin


class UserLimited(UserNotification):
    action: ActionType = ActionType.user_limited
    user: UserResponse


class UserExpired(UserNotification):
    action: ActionType = ActionType.user_expired
    user: UserResponse


class UserEnabled(UserNotification):
    action: ActionType = ActionType.user_enabled
    by: Admin
    user: UserResponse


class UserDisabled(UserNotification):
    action: ActionType = ActionType.user_disabled
    by: Admin
    user: UserResponse
    reason: str = None


def notify(message: Type[Notification]) -> None:
    if config.WEBHOOK_ADDRESS:
        queue.append(message)

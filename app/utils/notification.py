from collections import deque
from typing import Literal
import config
from datetime import datetime as dt

from pydantic import BaseModel


queue = deque()


class Notification(BaseModel):
    username: str
    action: Literal["user_created", "user_updated", "user_deleted",
                    "user_limited", "user_expired", "user_disabled", "user_enabled"]
    enqueued_at: float = dt.utcnow().timestamp()
    tries: int = 0


def notify(message: Notification) -> None:
    if config.WEBHOOK_ADDRESS:
        queue.append(message)

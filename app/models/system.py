from datetime import datetime
from typing import List

from pydantic import BaseModel


class SystemStats(BaseModel):
    version: str
    mem_total: int
    mem_used: int
    cpu_cores: int
    cpu_usage: float
    total_user: int
    online_users: int
    users_active: int
    users_on_hold: int
    users_disabled: int
    users_expired: int
    users_limited: int
    incoming_bandwidth: int
    outgoing_bandwidth: int
    incoming_bandwidth_speed: int
    outgoing_bandwidth_speed: int


class UsagePoint(BaseModel):
    """One bucket of the traffic series."""
    time: datetime
    uplink: int
    downlink: int


class UsageSeries(BaseModel):
    period: str
    granularity: str  # "hour" or "day"
    points: List[UsagePoint]

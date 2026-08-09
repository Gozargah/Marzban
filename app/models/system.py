from typing import List

from pydantic import BaseModel


class DevicePlatformCount(BaseModel):
    platform: str
    count: int


class DeviceStats(BaseModel):
    total_devices: int
    active_devices: int
    revoked_devices: int
    users_with_limit: int
    users_over_limit: int
    by_platform: List[DevicePlatformCount]


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

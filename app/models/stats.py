from enum import Enum
from datetime import datetime as dt

from pydantic import BaseModel, field_validator

from .validators import NumericValidatorMixin


class Period(str, Enum):
    minute = "minute"
    hour = "hour"
    day = "day"
    month = "month"


class UserUsageStats(BaseModel):
    total_traffic: int
    period: Period
    period_start: dt

    @field_validator("total_traffic", mode="before")
    def cast_to_int(cls, v):
        return NumericValidatorMixin.cast_to_int(v)


class NodeUsageStats(BaseModel):
    uplink: int
    downlink: int
    period: Period
    period_start: dt

    @field_validator("downlink", "uplink", mode="before")
    def cast_to_int(cls, v):
        return NumericValidatorMixin.cast_to_int(v)


class NodeStats(BaseModel):
    mem_total: int
    mem_used: int
    cpu_cores: int
    cpu_usage: float
    incoming_bandwidth_speed: int
    outgoing_bandwidth_speed: int

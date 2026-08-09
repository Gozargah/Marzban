from datetime import datetime
from typing import List, Optional

from pydantic import BaseModel, ConfigDict, Field


class HostGroupBase(BaseModel):
    name: str = Field(..., min_length=1, max_length=128)
    # per-user limit in bytes; 0/None = unlimited (group still tracked & shown)
    traffic_limit: Optional[int] = Field(default=None, ge=0)
    reset_strategy: str = "no_reset"
    notice_text: Optional[str] = Field(default=None, max_length=512)
    include_master: bool = False


class HostGroupCreate(HostGroupBase):
    host_ids: List[int] = []
    node_ids: List[int] = []


class HostGroupModify(BaseModel):
    name: Optional[str] = Field(default=None, min_length=1, max_length=128)
    traffic_limit: Optional[int] = Field(default=None, ge=0)
    reset_strategy: Optional[str] = None
    notice_text: Optional[str] = Field(default=None, max_length=512)
    include_master: Optional[bool] = None
    host_ids: Optional[List[int]] = None
    node_ids: Optional[List[int]] = None


class HostGroupResponse(HostGroupBase):
    id: int
    host_ids: List[int] = []
    node_ids: List[int] = []
    created_at: Optional[datetime] = None
    model_config = ConfigDict(from_attributes=True)


class UserGroupUsageResponse(BaseModel):
    group_id: int
    group_name: str
    member: bool = False                     # is the user added to this group
    used_traffic: int
    traffic_limit: Optional[int] = None      # effective limit (override or group)
    group_default_limit: Optional[int] = None  # the group's own default
    limit_override: Optional[int] = None     # per-user override, None if unset
    limit_source: str = "group"              # "user" | "group" | "unlimited"
    remaining: Optional[int] = None
    over_limit: bool = False
    reset_at: Optional[datetime] = None
    model_config = ConfigDict(from_attributes=True)


class UserGroupLimitSet(BaseModel):
    # add/remove the user from the group
    member: Optional[bool] = None
    # bytes; 0/None clears the override (fall back to the group default).
    # Only applied when set_limit is true (lets you toggle membership alone).
    traffic_limit: Optional[int] = Field(default=None, ge=0)
    set_limit: bool = False

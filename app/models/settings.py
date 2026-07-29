from typing import Optional

from pydantic import BaseModel, ConfigDict


class SubscriptionSettings(BaseModel):
    sub_profile_title: Optional[str] = None
    sub_support_url: Optional[str] = None
    sub_update_interval: Optional[str] = None
    active_status_text: Optional[str] = None
    expired_status_text: Optional[str] = None
    limited_status_text: Optional[str] = None
    disabled_status_text: Optional[str] = None
    onhold_status_text: Optional[str] = None
    device_limit_exceeded_message: Optional[str] = None
    model_config = ConfigDict(from_attributes=True)

from typing import Optional

from pydantic import BaseModel, ConfigDict


class SubscriptionSettings(BaseModel):
    sub_profile_title: Optional[str] = None
    sub_support_url: Optional[str] = None
    sub_update_interval: Optional[str] = None
    sub_announce: Optional[str] = None
    sub_announce_url: Optional[str] = None
    active_status_text: Optional[str] = None
    expired_status_text: Optional[str] = None
    limited_status_text: Optional[str] = None
    disabled_status_text: Optional[str] = None
    onhold_status_text: Optional[str] = None
    device_limit_exceeded_message: Optional[str] = None
    model_config = ConfigDict(from_attributes=True)


class EmailSettings(BaseModel):
    smtp_host: Optional[str] = None
    smtp_port: Optional[int] = None
    smtp_username: Optional[str] = None
    smtp_password: Optional[str] = None
    smtp_from_email: Optional[str] = None
    resend_api_key: Optional[str] = None
    resend_from_email: Optional[str] = None
    email_from_name: Optional[str] = None
    email_rules_text: Optional[str] = None
    model_config = ConfigDict(from_attributes=True)


class EmailSettingsResponse(BaseModel):
    """Same as EmailSettings but never echoes secrets back to the panel."""
    smtp_host: Optional[str] = None
    smtp_port: Optional[int] = None
    smtp_username: Optional[str] = None
    smtp_password_set: bool = False
    smtp_from_email: Optional[str] = None
    resend_api_key_set: bool = False
    resend_from_email: Optional[str] = None
    email_from_name: Optional[str] = None
    email_rules_text: Optional[str] = None
    model_config = ConfigDict(from_attributes=True)

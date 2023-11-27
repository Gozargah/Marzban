from pydantic import AnyHttpUrl, BaseModel, Field, ValidationError, validator
from typing import Union, Optional


class SystemStats(BaseModel):
    version: str
    mem_total: int
    mem_used: int
    cpu_cores: int
    cpu_usage: float
    total_user: int
    users_active: int
    incoming_bandwidth: int
    outgoing_bandwidth: int
    incoming_bandwidth_speed: int
    outgoing_bandwidth_speed: int


class Settings(BaseModel):
    dashboard_path: str = Field(regex=r'^\/?[/.a-zA-Z0-9-]+$')
    subscription_url_prefix: Union[AnyHttpUrl, None]
    subscription_page_title: Union[str, None]
    subscription_support_url_header: Union[str, None]
    subscription_update_interval_header: Union[int, None]
    webhook_url: Union[AnyHttpUrl, None]
    webhook_secret: Union[str, None]
    telegram_api_token: Union[str, None] = Field(regex=r'^$|^[0-9]{8,10}:[a-zA-Z0-9_-]{35}$')
    telegram_admin_ids: Union[str, None]
    telegram_logs_channel_id: Union[str, None]
    discord_webhook_url: Union[AnyHttpUrl, None]
    jwt_token_expire_minutes: Union[int, None]

    class Config:
        orm_mode = True

    @property
    def telegram_admins(self):
        return list(map(int, self.telegram_admin_ids.strip(',').split(',')))


class SettingsModify(Settings):
    dashboard_path: Optional[str] = Field(regex=r'^\/?[/.a-zA-Z0-9-]+$', default=None)
    subscription_url_prefix: Optional[AnyHttpUrl] = None
    subscription_page_title: Optional[str] = None
    subscription_support_url_header: Optional[str] = None
    subscription_update_interval_header: Optional[int] = None
    webhook_url: Optional[AnyHttpUrl] = None
    webhook_secret: Optional[str] = None
    telegram_api_token: Optional[str] = Field(regex=r'^$|^[0-9]{8,10}:[a-zA-Z0-9_-]{35}$', default=None)
    telegram_admin_ids: Optional[str] = None
    telegram_logs_channel_id: Optional[str] = None
    discord_webhook_url: Optional[AnyHttpUrl] = None
    jwt_token_expire_minutes: Optional[int] = None

    @validator('dashboard_path')
    def validate_dashboard_path(cls, value):
        if not value.startswith('/'):
            return '/' + value
        return value

    @validator('telegram_admin_ids')
    def validate_telegram_admin_ids(cls, value):
        try:
            list(map(int, value.strip(',').split(',')))
        except ValueError as exc:
            v = str(exc).replace("invalid literal for int() with base 10: '", '')[:-1].strip()
            raise ValueError(f'\'{v}\' is not a valid Telegram ID')

        return value

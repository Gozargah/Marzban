import re
from enum import Enum

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator

from app.models.proxy import ShadowsocksMethods, XTLSFlows

from .validators import DiscordValidator, ListValidator, ProxyValidator


TELEGRAM_TOKEN_PATTERN = r"^\d{8,12}:[A-Za-z0-9_-]{35}$"


class Telegram(BaseModel):
    enable: bool = Field(default=False)
    token: str | None = Field(default=None)
    webhook_url: str | None = Field(default=None)
    webhook_secret: str | None = Field(default=None)
    proxy_url: str | None = Field(default=None)

    mini_app_login: bool = Field(default=True)

    @field_validator("proxy_url")
    @classmethod
    def validate_proxy_url(cls, v):
        return ProxyValidator.validate_proxy_url(v)

    @field_validator("token")
    @classmethod
    def token_validation(cls, v):
        if not v:
            return v
        if not re.match(TELEGRAM_TOKEN_PATTERN, v):
            raise ValueError("Invalid telegram token format")
        return v

    @model_validator(mode="after")
    def check_enable_requires_token_and_url(self):
        if self.enable and (not self.token or not self.webhook_url or not self.webhook_secret):
            raise ValueError("Telegram bot cannot be enabled without token, webhook_url and webhook_secret.")
        return self


class Discord(BaseModel):
    enable: bool = Field(default=False)
    token: str | None = Field(default=None)
    proxy_url: str | None = Field(default=None)

    @field_validator("proxy_url")
    @classmethod
    def validate_proxy_url(cls, v):
        return ProxyValidator.validate_proxy_url(v)

    @model_validator(mode="after")
    def check_enable_requires_token(self):
        if self.enable and not self.token:
            raise ValueError("Discord bot cannot be enabled without token.")
        return self


class WebhookInfo(BaseModel):
    url: str
    secret: str


class Webhook(BaseModel):
    enable: bool = Field(default=False)
    webhooks: list[WebhookInfo] = Field(default=[])
    days_left: list[int] = Field(default=[])
    usage_percent: list[int] = Field(default=[])
    timeout: int = Field(gt=1)
    recurrent: int = Field(gt=1)
    proxy_url: str | None = Field(default=None)

    @field_validator("proxy_url", mode="before")
    @classmethod
    def validate_proxy_url(cls, v):
        return ProxyValidator.validate_proxy_url(v)

    @field_validator("days_left", "usage_percent", mode="before")
    @classmethod
    def validate_lists(cls, v):
        return ListValidator.not_null_list(v, "list")

    @model_validator(mode="after")
    def check_enable_requires_webhookinfo(self):
        if self.enable and (not self.webhooks or len(self.webhooks) == 0):
            raise ValueError("Webhook cannot be enabled without at least one WebhookInfo.")
        return self


class NotificationSettings(BaseModel):
    # Define Which Notfication System Work's
    notify_telegram: bool = Field(default=False)
    notify_discord: bool = Field(default=False)

    # Telegram Settings
    telegram_api_token: str | None = Field(default=None)
    telegram_admin_id: int | None = Field(default=None)
    telegram_channel_id: int | None = Field(default=None)
    telegram_topic_id: int | None = Field(default=None)

    # Discord Settings
    discord_webhook_url: str | None = Field(default=None)

    # Proxy Settings
    proxy_url: str | None = Field(default=None)

    max_retries: int = Field(gt=1)

    @field_validator("proxy_url", mode="before")
    @classmethod
    def validate_proxy_url(cls, v):
        return ProxyValidator.validate_proxy_url(v)

    @field_validator("discord_webhook_url", mode="before")
    @classmethod
    def validate_discord_webhook(cls, value):
        return DiscordValidator.validate_webhook(value)

    @model_validator(mode="after")
    def check_notify_discord_requires_url(self):
        if self.notify_discord and not self.discord_webhook_url:
            raise ValueError("Discord notification cannot be enabled without webhook url.")
        return self

    @model_validator(mode="after")
    def check_notify_telegram_requires_token_and_id(self):
        if self.notify_telegram and (
            not self.telegram_api_token or not (self.telegram_channel_id, self.telegram_admin_id)
        ):
            raise ValueError("Telegram notification cannot be enabled without token or admin/channel id.")
        return self


class NotificationEnable(BaseModel):
    admin: bool = Field(default=True)
    core: bool = Field(default=True)
    group: bool = Field(default=True)
    host: bool = Field(default=True)
    login: bool = Field(default=True)
    node: bool = Field(default=True)
    user: bool = Field(default=True)
    user_template: bool = Field(default=True)
    days_left: bool = Field(default=True)
    percentage_reached: bool = Field(default=True)


class ConfigFormat(str, Enum):
    links = "links"
    links_base64 = "links_base64"
    xray = "xray"
    sing_box = "sing_box"
    clash = "clash"
    clash_meta = "clash_meta"
    outline = "outline"
    block = "block"


class SubRule(BaseModel):
    pattern: str
    target: ConfigFormat


class SubFormatEnable(BaseModel):
    links: bool = Field(default=True)
    links_base64: bool = Field(default=True)
    xray: bool = Field(default=True)
    sing_box: bool = Field(default=True)
    clash: bool = Field(default=True)
    clash_meta: bool = Field(default=True)
    outline: bool = Field(default=True)


class Subscription(BaseModel):
    url_prefix: str = Field(default="")
    update_interval: int = Field(default=12)
    support_url: str = Field(default="https://t.me/")
    profile_title: str = Field(default="Subscription")

    host_status_filter: bool

    # Rules To Seperate Clients And Send Config As Needed
    rules: list[SubRule]
    manual_sub_request: SubFormatEnable = Field(default_factory=SubFormatEnable)


class General(BaseModel):
    default_flow: XTLSFlows = Field(default=XTLSFlows.NONE)
    default_method: ShadowsocksMethods = Field(default=ShadowsocksMethods.CHACHA20_POLY1305)


class SettingsSchema(BaseModel):
    telegram: Telegram | None = Field(default=None)
    discord: Discord | None = Field(default=None)
    webhook: Webhook | None = Field(default=None)
    notification_settings: NotificationSettings | None = Field(default=None)
    notification_enable: NotificationEnable | None = Field(default=None)
    subscription: Subscription | None = Field(default=None)
    general: General | None = Field(default=None)

    model_config = ConfigDict(from_attributes=True)

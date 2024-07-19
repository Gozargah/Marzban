import re
from datetime import datetime
from enum import Enum
from typing import Dict, List, Optional, Union
import random
import secrets

from pydantic import BaseModel, Field, validator

from app import xray
from app.models.proxy import ProxySettings, ProxyTypes
from app.models.admin import Admin
from app.utils.jwt import create_subscription_token
from app.subscription.share import generate_v2ray_links
from config import XRAY_SUBSCRIPTION_PATH, XRAY_SUBSCRIPTION_URL_PREFIX

USERNAME_REGEXP = re.compile(r"^(?=\w{3,32}\b)[a-zA-Z0-9-_@.]+(?:_[a-zA-Z0-9-_@.]+)*$")


class ReminderType(str, Enum):
    expiration_date = "expiration_date"
    data_usage = "data_usage"


class UserStatus(str, Enum):
    active = "active"
    disabled = "disabled"
    limited = "limited"
    expired = "expired"
    on_hold = "on_hold"


class UserStatusModify(str, Enum):
    active = "active"
    disabled = "disabled"
    on_hold = "on_hold"


class UserStatusCreate(str, Enum):
    active = "active"
    on_hold = "on_hold"


class UserDataLimitResetStrategy(str, Enum):
    no_reset = "no_reset"
    day = "day"
    week = "week"
    month = "month"
    year = "year"


class User(BaseModel):
    proxies: Dict[ProxyTypes, ProxySettings] = {}
    expire: Optional[int] = Field(None, nullable=True)
    data_limit: Optional[int] = Field(
        ge=0, default=None, description="data_limit can be 0 or greater"
    )
    data_limit_reset_strategy: UserDataLimitResetStrategy = (
        UserDataLimitResetStrategy.no_reset
    )
    inbounds: Dict[ProxyTypes, List[str]] = {}
    note: Optional[str] = Field(None, nullable=True)
    sub_updated_at: Optional[datetime] = Field(None, nullable=True)
    sub_last_user_agent: Optional[str] = Field(None, nullable=True)
    online_at: Optional[datetime] = Field(None, nullable=True)
    on_hold_expire_duration: Optional[int] = Field(None, nullable=True)
    on_hold_timeout: Optional[Union[datetime, None]] = Field(None, nullable=True)

    auto_delete_in_days: Optional[int] = Field(None, nullable=True)

    @validator("proxies", pre=True, always=True)
    def validate_proxies(cls, v, values, **kwargs):
        if not v:
            raise ValueError("Each user needs at least one proxy")
        return {
            proxy_type: ProxySettings.from_dict(
                proxy_type, v.get(proxy_type, {}))
            for proxy_type in v
        }

    @validator("username", check_fields=False)
    def validate_username(cls, v):
        if not USERNAME_REGEXP.match(v):
            raise ValueError(
                "Username only can be 3 to 32 characters and contain a-z, 0-9, and underscores in between."
            )
        return v

    @validator("note", check_fields=False)
    def validate_note(cls, v):
        if v and len(v) > 500:
            raise ValueError("User's note can be a maximum of 500 character")
        return v

    @validator("on_hold_expire_duration", "on_hold_timeout", pre=True, always=True)
    def validate_timeout(cls, v, values):
        # Check if expire is 0 or None and timeout is not 0 or None
        if (v in (0, None)):
            return None
        return v


class UserCreate(User):
    username: str
    status: UserStatusCreate = None

    class Config:
        schema_extra = {
            "example": {
                "username": "user1234",
                "proxies": {
                    "vmess": {"id": "35e4e39c-7d5c-4f4b-8b71-558e4f37ff53"},
                    "vless": {},
                },
                "inbounds": {
                    "vmess": ["VMess TCP", "VMess Websocket"],
                    "vless": ["VLESS TCP REALITY", "VLESS GRPC REALITY"],
                },
                "expire": 0,
                "data_limit": 0,
                "data_limit_reset_strategy": "no_reset",
                "status": "active",
                "note": "",
                "on_hold_timeout": "2023-11-03T20:30:00",
                "on_hold_expire_duration": 0,
            }
        }

    @property
    def excluded_inbounds(self):
        excluded = {}
        for proxy_type in self.proxies:
            excluded[proxy_type] = []
            for inbound in xray.config.inbounds_by_protocol.get(proxy_type, []):
                if not inbound["tag"] in self.inbounds.get(proxy_type, []):
                    excluded[proxy_type].append(inbound["tag"])

        return excluded

    @validator("inbounds", pre=True, always=True)
    def validate_inbounds(cls, inbounds, values, **kwargs):
        proxies = values.get("proxies", [])

        # delete inbounds that are for protocols not activated
        for proxy_type in inbounds.copy():
            if proxy_type not in proxies:
                del inbounds[proxy_type]

        # check by proxies to ensure that every protocol has inbounds set
        for proxy_type in proxies:
            tags = inbounds.get(proxy_type)

            if tags:
                for tag in tags:
                    if tag not in xray.config.inbounds_by_tag:
                        raise ValueError(f"Inbound {tag} doesn't exist")

            # elif isinstance(tags, list) and not tags:
            #     raise ValueError(f"{proxy_type} inbounds cannot be empty")

            else:
                inbounds[proxy_type] = [
                    i["tag"]
                    for i in xray.config.inbounds_by_protocol.get(proxy_type, [])
                ]

        return inbounds

    @validator("status", pre=True, always=True)
    def validate_status(cls, value):
        if not value or value not in UserStatusCreate.__members__:
            return UserStatusCreate.active  # Set to the default if not valid
        return value

    @validator("status", pre=True, always=True, allow_reuse=True)
    def validate_status(cls, status, values):
        on_hold_expire = values.get("on_hold_expire_duration")
        expire = values.get("expire")
        if status == UserStatusCreate.on_hold:
            if (on_hold_expire == 0 or on_hold_expire is None):
                raise ValueError("User cannot be on hold without a valid on_hold_expire_duration.")
            if expire:
                raise ValueError("User cannot be on hold with specified expire.")
        return status


class UserModify(User):
    status: UserStatusModify = None
    data_limit_reset_strategy: UserDataLimitResetStrategy = None

    class Config:
        schema_extra = {
            "example": {
                "proxies": {
                    "vmess": {"id": "35e4e39c-7d5c-4f4b-8b71-558e4f37ff53"},
                    "vless": {},
                },
                "inbounds": {
                    "vmess": ["VMess TCP", "VMess Websocket"],
                    "vless": ["VLESS TCP REALITY", "VLESS GRPC REALITY"],
                },
                "expire": 0,
                "data_limit": 0,
                "data_limit_reset_strategy": "no_reset",
                "status": "active",
                "note": "",
                "on_hold_timeout": "2023-11-03T20:30:00",
                "on_hold_expire_duration": 0,
            }
        }

    @property
    def excluded_inbounds(self):
        excluded = {}
        for proxy_type in self.inbounds:
            excluded[proxy_type] = []
            for inbound in xray.config.inbounds_by_protocol.get(proxy_type, []):
                if not inbound["tag"] in self.inbounds.get(proxy_type, []):
                    excluded[proxy_type].append(inbound["tag"])

        return excluded

    @validator("inbounds", pre=True, always=True)
    def validate_inbounds(cls, inbounds, values, **kwargs):
        # check with inbounds, "proxies" is optional on modifying
        # so inbounds particularly can be modified
        if inbounds:
            for proxy_type, tags in inbounds.items():

                # if not tags:
                #     raise ValueError(f"{proxy_type} inbounds cannot be empty")

                for tag in tags:
                    if tag not in xray.config.inbounds_by_tag:
                        raise ValueError(f"Inbound {tag} doesn't exist")

        return inbounds

    @validator("proxies", pre=True, always=True)
    def validate_proxies(cls, v):
        return {
            proxy_type: ProxySettings.from_dict(
                proxy_type, v.get(proxy_type, {}))
            for proxy_type in v
        }

    @validator("status", pre=True, always=True, allow_reuse=True)
    def validate_status(cls, status, values):
        on_hold_expire = values.get("on_hold_expire_duration")
        expire = values.get("expire")
        if status == UserStatusCreate.on_hold:
            if (on_hold_expire == 0 or on_hold_expire is None):
                raise ValueError("User cannot be on hold without a valid on_hold_expire_duration.")
            if expire:
                raise ValueError("User cannot be on hold with specified expire.")
        return status


class UserResponse(User):
    username: str
    status: UserStatus
    used_traffic: int
    lifetime_used_traffic: int = 0
    created_at: datetime
    links: List[str] = []
    subscription_url: str = ""
    proxies: dict
    excluded_inbounds: Dict[ProxyTypes, List[str]] = {}

    admin: Optional[Admin]

    class Config:
        orm_mode = True

    @validator("links", pre=False, always=True)
    def validate_links(cls, v, values, **kwargs):
        if not v:
            return generate_v2ray_links(
                values.get("proxies", {}), values.get("inbounds", {}), extra_data=values, reverse=False,
            )
        return v

    @validator("subscription_url", pre=False, always=True)
    def validate_subscription_url(cls, v, values, **kwargs):
        if not v:
            salt = secrets.token_hex(8)
            url_prefix = (XRAY_SUBSCRIPTION_URL_PREFIX).replace('*', salt)
            token = create_subscription_token(values["username"])
            return f"{url_prefix}/{XRAY_SUBSCRIPTION_PATH}/{token}"
        return v

    @validator("proxies", pre=True, always=True)
    def validate_proxies(cls, v, values, **kwargs):
        if isinstance(v, list):
            v = {p.type: p.settings for p in v}
        return super().validate_proxies(v, values, **kwargs)


class SubscriptionUserResponse(UserResponse):
    class Config:
        orm_mode = True
        fields = {
            field: {"include": True} for field in [
                "username",
                "status",
                "expire",
                "data_limit",
                "data_limit_reset_strategy",
                "used_traffic",
                "lifetime_used_traffic",
                "proxies",
                "created_at",
                "sub_updated_at",
                "online_at",
                "links",
                "subscription_url",
                "sub_updated_at",
                "sub_last_user_agent",
                "online_at",
            ]
        }


class UsersResponse(BaseModel):
    users: List[UserResponse]
    total: int


class UserUsageResponse(BaseModel):
    node_id: Union[int, None]
    node_name: str
    used_traffic: int


class UserUsagesResponse(BaseModel):
    username: str
    usages: List[UserUsageResponse]

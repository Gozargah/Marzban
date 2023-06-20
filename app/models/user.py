import re
from datetime import datetime
from enum import Enum
from typing import Dict, List, Union

from pydantic import BaseModel, Field, validator

from app import xray
from app.models.proxy import ProxySettings, ProxyTypes
from app.utils.jwt import create_subscription_token
from app.utils.share import generate_v2ray_links
from config import XRAY_SUBSCRIPTION_URL_PREFIX
from xray_api.types.account import Account

USERNAME_REGEXP = re.compile(r'^(?=\w{3,32}\b)[a-zA-Z0-9]+(?:_[a-zA-Z0-9]+)*$')


class UserStatus(str, Enum):
    active = "active"
    disabled = "disabled"
    limited = "limited"
    expired = "expired"


class UserStatusModify(str, Enum):
    active = "active"
    disabled = "disabled"


class UserDataLimitResetStrategy(str, Enum):
    no_reset = "no_reset"
    day = "day"
    week = "week"
    month = "month"
    year = "year"


class User(BaseModel):
    proxies: Dict[ProxyTypes, ProxySettings] = {}
    expire: int = None
    data_limit: Union[None, int] = Field(ge=0, default=None, description="data_limit can be 0 or greater")
    data_limit_reset_strategy: UserDataLimitResetStrategy = UserDataLimitResetStrategy.no_reset
    inbounds: Dict[ProxyTypes, List[str]] = {}

    @validator('proxies', pre=True, always=True)
    def validate_proxies(cls, v, values, **kwargs):
        if not v:
            raise ValueError("Each user needs at least one proxy")
        return {proxy_type: ProxySettings.from_dict(proxy_type, v.get(proxy_type, {})) for proxy_type in v}

    @validator('username', check_fields=False)
    def validate_username(cls, v):
        if not USERNAME_REGEXP.match(v):
            raise ValueError('Username only can be 3 to 32 characters and contain a-z, 0-9, and underscores in between.')
        return v


class UserCreate(User):
    username: str

    class Config:
        schema_extra = {
            "example": {
                "username": "user1234",
                "proxies": {
                    "vmess": {
                        "id": "35e4e39c-7d5c-4f4b-8b71-558e4f37ff53"
                    },
                    "vless": {}
                },
                "inbounds": {
                    "vmess": [
                        "VMESS_INBOUND"
                    ],
                    "vless": [
                        "VLESS_INBOUND"
                    ]
                },
                "expire": 0,
                "data_limit": 0,
                "data_limit_reset_strategy": "no_reset"
            }
        }

    @property
    def excluded_inbounds(self):
        excluded = {}
        for proxy_type in self.proxies:
            excluded[proxy_type] = []
            for inbound in xray.config.inbounds_by_protocol.get(proxy_type, []):
                if not inbound['tag'] in self.inbounds.get(proxy_type, []):
                    excluded[proxy_type].append(inbound['tag'])

        return excluded

    @validator('inbounds', pre=True, always=True)
    def validate_inbounds(cls, inbounds, values, **kwargs):
        proxies = values.get('proxies', [])

        # delete inbounds that are for protocols not activated
        for proxy_type in inbounds.copy():
            if proxy_type not in proxies:
                del inbounds[proxy_type]

        # check by proxies to ensure that every protocol has inbounds set
        for proxy_type in proxies:
            tags = inbounds.get(proxy_type)

            if isinstance(tags, list) and not tags:
                raise ValueError(f"{proxy_type} inbounds cannot be empty")

            elif tags:
                for tag in tags:
                    if tag not in xray.config.inbounds_by_tag:
                        raise ValueError(f"Inbound {tag} doesn't exist")

            else:
                inbounds[proxy_type] = [i['tag'] for i in xray.config.inbounds_by_protocol.get(proxy_type, [])]

        return inbounds


class UserModify(User):
    status: UserStatusModify = None
    data_limit_reset_strategy: UserDataLimitResetStrategy = None

    class Config:
        schema_extra = {
            "example": {
                "proxies": {
                    "vmess": {
                        "id": "35e4e39c-7d5c-4f4b-8b71-558e4f37ff53"
                    },
                    "vless": {}
                },
                "inbounds": {
                    "vmess": [
                        "VMESS_INBOUND"
                    ],
                    "vless": [
                        "VLESS_INBOUND"
                    ]
                },
                "expire": 0,
                "data_limit": 0,
                "data_limit_reset_strategy": "no_reset",
                "status": "active"
            }
        }

    @property
    def excluded_inbounds(self):
        excluded = {}
        for proxy_type in self.inbounds:
            excluded[proxy_type] = []
            for inbound in xray.config.inbounds_by_protocol.get(proxy_type, []):
                if not inbound['tag'] in self.inbounds.get(proxy_type, []):
                    excluded[proxy_type].append(inbound['tag'])

        return excluded

    @validator('inbounds', pre=True, always=True)
    def validate_inbounds(cls, inbounds, values, **kwargs):
        # check with inbounds, "proxies" is optional on modifying
        # so inbounds particularly can be modified
        if inbounds:
            for proxy_type, tags in inbounds.items():
                if not tags:
                    raise ValueError(f"{proxy_type} inbounds cannot be empty")

                for tag in tags:
                    if tag not in xray.config.inbounds_by_tag:
                        raise ValueError(f"Inbound {tag} doesn't exist")

        return inbounds

    @validator('proxies', pre=True, always=True)
    def validate_proxies(cls, v):
        return {proxy_type: ProxySettings.from_dict(proxy_type, v.get(proxy_type, {})) for proxy_type in v}


class UserResponse(User):
    username: str
    status: UserStatus
    used_traffic: int
    lifetime_used_traffic: int = 0
    created_at: datetime
    links: List[str] = []
    subscription_url: str = ''
    proxies: dict
    excluded_inbounds: Dict[ProxyTypes, List[str]] = {}

    class Config:
        orm_mode = True

    @validator('links', pre=False, always=True)
    def validate_links(cls, v, values, **kwargs):
        if not v:
            return generate_v2ray_links(values.get('proxies', {}),
                                        values.get('inbounds', {}),
                                        extra_data=values)
        return v

    @validator('subscription_url', pre=False, always=True)
    def validate_subscription_url(cls, v, values, **kwargs):
        if not v:
            token = create_subscription_token(values['username'])
            return f'{XRAY_SUBSCRIPTION_URL_PREFIX}/sub/{token}'
        return v

    @validator('proxies', pre=True, always=True)
    def validate_proxies(cls, v, values, **kwargs):
        if isinstance(v, list):
            v = {p.type: p.settings for p in v}
        return super().validate_proxies(v, values, **kwargs)


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

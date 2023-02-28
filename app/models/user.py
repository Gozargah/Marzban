import re
from datetime import datetime
from enum import Enum
from typing import Dict, List

from app.models.proxy import ProxySettings, ProxyTypes
from app.utils.jwt import create_subscription_token
from app.utils.share import ShareLink
from config import XRAY_HOSTS, XRAY_SUBSCRIPTION_URL_PREFIX
from pydantic import BaseModel, validator
from xray_api.types.account import Account

USERNAME_REGEXP = re.compile(r'^(?=\w{3,32}\b)[a-zA-Z0-9]+(?:_[a-zA-Z0-9]+)*$')


class UserStatus(str, Enum):
    active = "active"
    disabled = "disabled"
    limited = "limited"
    expired = "expired"
    
class UserDataLimitResetStrategy(str,Enum):
    no_reset = "no_reset"
    day = "day"
    week = "week"
    month = "month"
    year = "year"


class User(BaseModel):
    proxies: Dict[ProxyTypes, ProxySettings] = {}
    expire: int = None
    data_limit: int = None
    data_limit_reset_strategy: UserDataLimitResetStrategy = UserDataLimitResetStrategy.no_reset

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

    def get_account(self, proxy_type: ProxyTypes) -> Account:
        if not getattr(self, 'username'):
            return

        try:
            attrs = self.proxies[proxy_type].dict(no_obj=True)
        except KeyError:
            raise LookupError(f'User do not have {proxy_type} proxy activated')

        return ProxyTypes(proxy_type).account_model(email=self.username, **attrs)


class UserCreate(User):
    username: str
    data_limit_reset_strategy: UserDataLimitResetStrategy = UserDataLimitResetStrategy.no_reset

    class Config:
        schema_extra = {
            "example": {
                "proxies": {
                    "vmess": {},
                    "vless": {"id": "62711da4-80eb-7772-5c0a-c2e7677d0c7b"},
                    "trojan": {},
                    "shadowsocks": {"password": "ThisIsSecret"}
                },
                "expire": 0,
                "data_limit": 0,
                "username": "string"
            }
        }


class UserModify(User):
    expire: int = None
    data_limit: int = None
    proxies: Dict[ProxyTypes, ProxySettings] = None
    data_limit_reset_strategy: UserDataLimitResetStrategy = UserDataLimitResetStrategy.no_reset

    class Config:
        schema_extra = {
            "example": {
                "proxies": {
                    "vless": {"id": "62711da4-80eb-7772-5c0a-c2e7677d0c7b"}
                },
                "expire": 0,
                "data_limit": 0
            }
        }


class UserResponse(User):
    username: str
    status: UserStatus
    used_traffic: int
    lifetime_used_traffic: int = 0
    created_at: datetime
    links: List[str] = []
    subscription_url: str = ''
    proxies: dict

    class Config:
        orm_mode = True

    @validator('links', pre=False, always=True)
    def validate_links(cls, v, values, **kwargs):
        if not v:
            links = []
            for host in XRAY_HOSTS:
                for proxy_type, settings in values.get('proxies', {}).items():
                    link = ShareLink(f"{host['remark']} ({values['username']})",
                                     host['address'],
                                     proxy_type,
                                     settings.dict(),
                                     custom_sni=host['sni'],
                                     custom_host=host['host'])
                    links.extend(link.split('\n'))
            return links
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

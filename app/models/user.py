from enum import Enum
from typing import Union, List
from pydantic import BaseModel, validator

from app.models.proxy import ProxyTypes, ProxySettings
from app.utils import get_share_links
from xray_api.types.account import Account


class UserStatus(str, Enum):
    active = "active"
    disabled = "disabled"
    limited = "limited"
    expired = "expired"


class User(BaseModel):
    proxy_type: ProxyTypes
    settings: ProxySettings = {}
    expire: int = None
    data_limit: int = None

    @validator('settings', pre=True, always=True)
    def validate_settings(cls, v, values, **kwargs):
        if isinstance(v, dict):
            return ProxySettings.from_dict(values['proxy_type'], v)
        return v

    def get_account(self) -> Account:
        if not getattr(self, 'username'):
            return

        if isinstance(self.settings, ProxySettings):
            return self.proxy_type.account_model(email=self.username, **self.settings.dict())

        return self.proxy_type.account_model(email=self.username, **self.settings)


class UserCreate(User):
    username: str


class UserModify(User):
    proxy_type: ProxyTypes = None
    expire: int = None
    data_limit: int = None
    settings: ProxySettings = None

    @validator('settings', pre=True, always=True)
    def validate_settings(cls, v, values, **kwargs):
        if v is not None and values.get('proxy_type') is None:
            raise ValueError("proxy_type field must be specified when settings field is set")
        return super().validate_settings(v, values, **kwargs)


class UserResponse(User):
    username: str
    status: UserStatus
    used_traffic: int
    settings: Union[dict, ProxyTypes]
    links: List[str] = []

    class Config:
        orm_mode = True

    @validator('links', pre=False, always=True)
    def validate_links(cls, v, values, **kwargs):
        if not v:
            if isinstance(values['settings'], ProxySettings):
                return get_share_links(values['proxy_type'], values['settings'].dict())
            return get_share_links(values['proxy_type'], values['settings'])
        return v

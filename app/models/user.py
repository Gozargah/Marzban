import re
from datetime import datetime
from enum import Enum
from typing import Dict, List, Optional, Union, Any, Self
import random
import secrets

from pydantic import field_validator, ConfigDict, BaseModel, Field, model_validator
from app import xray
from app.models.proxy import ProxySettings, ProxyTypes
from app.models.admin import Admin
from app.utils.jwt import create_subscription_token
from app.subscription.share import generate_v2ray_links
from config import XRAY_SUBSCRIPTION_PATH, XRAY_SUBSCRIPTION_URL_PREFIX
from typing import Annotated
from sqlalchemy.orm.collections import InstrumentedList

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

class NextPlanModel(BaseModel):
    data_limit: Optional[int] = None
    expire: Optional[int] = None
    add_remaining_traffic: bool = False
    fire_on_either: bool = True
    model_config = ConfigDict(from_attributes=True)

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
    
    next_plan: Optional[NextPlanModel] = Field(None, nullable=True)
        
    @model_validator(mode='before')
    @classmethod
    def validate_proxies(cls, data: Any) -> Any:
        if isinstance(data, dict) and 'proxies' in data:
            if not data['proxies']:
                raise ValueError("Each user needs at least one proxy")
            v = data['proxies']
            data['proxies'] = {
                proxy_type: ProxySettings.from_dict(
                    proxy_type, v.get(proxy_type, {}))
                for proxy_type in v
            }
        return data

    @model_validator(mode='before')
    @classmethod
    def validate_username(cls, data: Any) -> Any:
        if isinstance(data, dict) and 'username' in data:
            if not USERNAME_REGEXP.match(data['username']):
                raise ValueError(
                    "Username only can be 3 to 32 characters and contain a-z, 0-9, and underscores in between."
                )
        return data

    @model_validator(mode='before')
    @classmethod
    def validate_note(cls, data: Any) -> Any:
        if isinstance(data, dict) and 'note' in data:
            if data['note'] and len(data['note']) > 500:
                raise ValueError("User's note can be a maximum of 500 character")
        return data

    @model_validator(mode='before')
    @classmethod
    def validate_timeout(cls, data: Any) -> Any:
        if isinstance(data, dict):
            for field in ['on_hold_expire_duration', 'on_hold_timeout']:
                if field in data and data[field] in (0, None):
                    data[field] = None
        return data


class UserCreate(User):
    username: str
    status: UserStatusCreate = None
    model_config = ConfigDict(json_schema_extra={
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
            "next_plan": {
                "data_limit": 0,
                "expire": 0,
                "add_remaining_traffic": False,
                "fire_on_either": True
            },
            "expire": 0,
            "data_limit": 0,
            "data_limit_reset_strategy": "no_reset",
            "status": "active",
            "note": "",
            "on_hold_timeout": "2023-11-03T20:30:00",
            "on_hold_expire_duration": 0,
        }
    })

    @property
    def excluded_inbounds(self):
        excluded = {}
        for proxy_type in self.proxies:
            excluded[proxy_type] = []
            for inbound in xray.config.inbounds_by_protocol.get(proxy_type, []):
                if not inbound["tag"] in self.inbounds.get(proxy_type, []):
                    excluded[proxy_type].append(inbound["tag"])

        return excluded

    @field_validator("inbounds", mode="before")
    def validate_inbounds(cls, inbounds, values, **kwargs):
        proxies = values.data.get("proxies", [])

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

    @field_validator("status", mode="before")
    def validate_status(cls, status, values):
        on_hold_expire = values.data.get("on_hold_expire_duration")
        expire = values.data.get("expire")
        if status == UserStatusCreate.on_hold:
            if (on_hold_expire == 0 or on_hold_expire is None):
                raise ValueError("User cannot be on hold without a valid on_hold_expire_duration.")
            if expire:
                raise ValueError("User cannot be on hold with specified expire.")
        return status


class UserModify(User):
    status: UserStatusModify = None
    data_limit_reset_strategy: UserDataLimitResetStrategy = None
    model_config = ConfigDict(json_schema_extra={
        "example": {
            "proxies": {
                "vmess": {"id": "35e4e39c-7d5c-4f4b-8b71-558e4f37ff53"},
                "vless": {},
            },
            "inbounds": {
                "vmess": ["VMess TCP", "VMess Websocket"],
                "vless": ["VLESS TCP REALITY", "VLESS GRPC REALITY"],
            },
            "next_plan": {
                "data_limit": 0,
                "expire": 0,
                "add_remaining_traffic": False,
                "fire_on_either": True
            },
            "expire": 0,
            "data_limit": 0,
            "data_limit_reset_strategy": "no_reset",
            "status": "active",
            "note": "",
            "on_hold_timeout": "2023-11-03T20:30:00",
            "on_hold_expire_duration": 0,
        }
    })

    @property
    def excluded_inbounds(self):
        excluded = {}
        for proxy_type in self.inbounds:
            excluded[proxy_type] = []
            for inbound in xray.config.inbounds_by_protocol.get(proxy_type, []):
                if not inbound["tag"] in self.inbounds.get(proxy_type, []):
                    excluded[proxy_type].append(inbound["tag"])

        return excluded

    @field_validator("inbounds", mode="before")
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

    @field_validator("proxies", mode="before")
    def validate_proxies(cls, v):
        return {
            proxy_type: ProxySettings.from_dict(
                proxy_type, v.get(proxy_type, {}))
            for proxy_type in v
        }

    @field_validator("status", mode="before")
    def validate_status(cls, status, values):
        on_hold_expire = values.data.get("on_hold_expire_duration")
        expire = values.data.get("expire")
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
    subscription_url: str = ""
    proxies: Dict[ProxyTypes, ProxySettings] = {}
    excluded_inbounds: Dict[ProxyTypes, List[str]] = {}
    admin: Optional[Admin] = None
    model_config = ConfigDict(from_attributes=True)

    @model_validator(mode='before')
    @classmethod
    def response(cls, data: Any) -> Any:
        if not data:
            return data

        if isinstance(data, dict):
            # Generate subscription URL
            salt = secrets.token_hex(8)
            url_prefix = (XRAY_SUBSCRIPTION_URL_PREFIX).replace('*', salt)
            token = create_subscription_token(data.get('username', ''))
            data['subscription_url'] = f"{url_prefix}/{XRAY_SUBSCRIPTION_PATH}/{token}"
            
            # Handle proxy conversion
            if "proxies" in data:
                proxies = data['proxies']
                proxy_dict = {}
                
                # Convert SQLAlchemy list to Python list if needed
                if hasattr(proxies, '_sa_instance_state'):
                    proxies = list(proxies)
                
                # Handle list of Proxy objects
                if isinstance(proxies, (list, InstrumentedList)):
                    for proxy in proxies:
                        # Get proxy type and settings
                        proxy_type = getattr(proxy, 'type', None)
                        settings = getattr(proxy, 'settings', {})
                        
                        if proxy_type:
                            # Ensure settings is a dictionary
                            if hasattr(settings, '_sa_instance_state'):
                                settings = dict(settings)
                            proxy_dict[proxy_type] = settings
                
                # Handle direct dictionary
                elif isinstance(proxies, dict):
                    proxy_dict = proxies
                
                data['proxies'] = proxy_dict or {}  # Ensure we always return a dict

        return data


class SubscriptionUserResponse(UserResponse):
    model_config = {
        "from_attributes": True,
        "model_fields": {
            "username": {"include": True},
            "status": {"include": True},
            "expire": {"include": True},
            "data_limit": {"include": True},
            "data_limit_reset_strategy": {"include": True},
            "used_traffic": {"include": True},
            "lifetime_used_traffic": {"include": True},
            "proxies": {"include": True},
            "created_at": {"include": True},
            "sub_updated_at": {"include": True},
            "online_at": {"include": True},
            "links": {"include": True},
            "subscription_url": {"include": True},
            "sub_last_user_agent": {"include": True},
        },
    }



class UsersResponse(BaseModel):
    users: List[UserResponse]
    total: int


class UserUsageResponse(BaseModel):
    node_id: Union[int, None] = None
    node_name: str
    used_traffic: int


class UserUsagesResponse(BaseModel):
    username: str
    usages: List[UserUsageResponse]

class UsersUsagesResponse(BaseModel):
    usages: List[UserUsageResponse]

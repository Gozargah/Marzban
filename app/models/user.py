from datetime import datetime as dt
from enum import Enum

from pydantic import BaseModel, ConfigDict, Field, field_validator

from app.db.models import UserDataLimitResetStrategy, UserStatus, UserStatusCreate
from app.models.admin import AdminBase, AdminContactInfo
from app.models.proxy import ProxyTable, ShadowsocksMethods, XTLSFlows
from app.utils.helpers import fix_datetime_timezone

from .validators import ListValidator, NumericValidatorMixin, UserValidator


class UserStatusModify(str, Enum):
    active = "active"
    disabled = "disabled"
    on_hold = "on_hold"


class NextPlanModel(BaseModel):
    user_template_id: int | None = Field(default=None)
    data_limit: int | None = Field(default=None)
    expire: int | None = Field(default=None)
    add_remaining_traffic: bool = False
    model_config = ConfigDict(from_attributes=True)


class User(BaseModel):
    proxy_settings: ProxyTable = Field(default_factory=ProxyTable)
    expire: dt | int | None = Field(default=None)
    data_limit: int | None = Field(ge=0, default=None, description="data_limit can be 0 or greater")
    data_limit_reset_strategy: UserDataLimitResetStrategy | None = Field(default=None)
    note: str | None = Field(max_length=500, default=None)
    on_hold_expire_duration: int | None = Field(default=None)
    on_hold_timeout: dt | int | None = Field(default=None)
    group_ids: list[int] | None = Field(default_factory=list)
    auto_delete_in_days: int | None = Field(default=None)

    next_plan: NextPlanModel | None = Field(default=None)


class UserWithValidator(User):
    @field_validator("on_hold_expire_duration")
    @classmethod
    def validate_timeout(cls, v):
        # Check if expire is 0 or None and timeout is not 0 or None
        if v in (0, None):
            return None
        return v

    @field_validator("on_hold_timeout", check_fields=False)
    @classmethod
    def validator_on_hold_timeout(cls, value):
        return UserValidator.validator_on_hold_timeout(value)

    @field_validator("expire", check_fields=False)
    @classmethod
    def validator_expire(cls, value):
        if not value:
            return value
        return fix_datetime_timezone(value)

    @field_validator("status", mode="before", check_fields=False)
    def validate_status(cls, status, values):
        return UserValidator.validate_status(status, values)


class UserCreate(UserWithValidator):
    username: str
    status: UserStatusCreate | None = Field(default=None)

    @field_validator("username", check_fields=False)
    @classmethod
    def validate_username(cls, v):
        return UserValidator.validate_username(v)

    @field_validator("group_ids", mode="after")
    @classmethod
    def group_ids_validator(cls, v):
        return ListValidator.not_null_list(v, "group")


class UserModify(UserWithValidator):
    status: UserStatusModify | None = Field(default=None)
    proxy_settings: ProxyTable | None = Field(default=None)

    @field_validator("group_ids", mode="after")
    @classmethod
    def group_ids_validator(cls, v):
        return ListValidator.nullable_list(v, "group")


class UserNotificationResponse(User):
    id: int
    username: str
    status: UserStatus
    used_traffic: int
    lifetime_used_traffic: int = 0
    created_at: dt
    edit_at: dt | None = Field(default=None)
    online_at: dt | None = Field(default=None)
    subscription_url: str = Field(default="")
    admin: AdminContactInfo | None = Field(default=None)
    model_config = ConfigDict(from_attributes=True)

    @field_validator("used_traffic", "lifetime_used_traffic", "data_limit", mode="before")
    @classmethod
    def cast_to_int(cls, v):
        return NumericValidatorMixin.cast_to_int(v)


class UserResponse(UserNotificationResponse):
    admin: AdminBase | None = None


class SubscriptionUserResponse(UserResponse):
    admin: AdminContactInfo | None = Field(default=None, exclude=True)
    note: str | None = Field(None, exclude=True)
    auto_delete_in_days: int | None = Field(None, exclude=True)
    subscription_url: str | None = Field(None, exclude=True)
    model_config = ConfigDict(from_attributes=True)


class UsersResponseWithInbounds(SubscriptionUserResponse):
    inbounds: list[str] | None = Field(default_factory=list)

    model_config = ConfigDict(from_attributes=True)


class UsersResponse(BaseModel):
    users: list[UserResponse]
    total: int


class UserSubscriptionUpdateSchema(BaseModel):
    created_at: dt
    user_agent: str

    model_config = ConfigDict(from_attributes=True)


class UserSubscriptionUpdateList(BaseModel):
    updates: list[UserSubscriptionUpdateSchema] = Field(default_factory=list)
    count: int


class RemoveUsersResponse(BaseModel):
    users: list[str]
    count: int


class ModifyUserByTemplate(BaseModel):
    user_template_id: int
    note: str | None = Field(max_length=500, default=None)


class CreateUserFromTemplate(ModifyUserByTemplate):
    username: str

    @field_validator("username", check_fields=False)
    @classmethod
    def validate_username(cls, v):
        return UserValidator.validate_username(v)


class BulkUser(BaseModel):
    amount: int
    group_ids: set[int] = Field(default_factory=set)
    admins: set[int] = Field(default_factory=set)
    users: set[int] = Field(default_factory=set)
    status: set[UserStatus] = Field(default_factory=set)


class BulkUsersProxy(BaseModel):
    flow: XTLSFlows | None = Field(default=None)
    method: ShadowsocksMethods | None = Field(default=None)
    group_ids: set[int] = Field(default_factory=set)
    admins: set[int] = Field(default_factory=set)
    users: set[int] = Field(default_factory=set)

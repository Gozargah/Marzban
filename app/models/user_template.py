import json

from pydantic import BaseModel, ConfigDict, Field, field_validator

from app.db.models import UserDataLimitResetStrategy, UserStatusCreate
from app.models.proxy import ShadowsocksMethods, XTLSFlows

from .validators import ListValidator, UserValidator


class ExtraSettings(BaseModel):
    flow: XTLSFlows | None = None
    method: ShadowsocksMethods | None = None

    def dict(self, *, no_obj=True, **kwargs):
        if no_obj:
            return json.loads(self.model_dump_json())
        return super().model_dump(**kwargs)


class UserTemplate(BaseModel):
    name: str | None = None
    data_limit: int | None = Field(ge=0, default=None, description="data_limit can be 0 or greater")
    expire_duration: int | None = Field(
        ge=0, default=None, description="expire_duration can be 0 or greater in seconds"
    )
    username_prefix: str | None = Field(max_length=20, default=None)
    username_suffix: str | None = Field(max_length=20, default=None)
    group_ids: list[int]
    extra_settings: ExtraSettings | None = None
    status: UserStatusCreate | None = None
    reset_usages: bool | None = None
    on_hold_timeout: int | None = None
    data_limit_reset_strategy: UserDataLimitResetStrategy = Field(default=UserDataLimitResetStrategy.no_reset)
    is_disabled: bool | None = None


class UserTemplateWithValidator(UserTemplate):
    @field_validator("status", mode="before", check_fields=False)
    def validate_status(cls, status, values):
        return UserValidator.validate_status(status, values)

    @field_validator("username_prefix", "username_suffix", check_fields=False)
    @classmethod
    def validate_username(cls, v):
        return UserValidator.validate_username(v, False, True)


class UserTemplateCreate(UserTemplateWithValidator):
    @field_validator("group_ids", mode="after")
    @classmethod
    def group_ids_validator(cls, v):
        return ListValidator.not_null_list(v, "group")


class UserTemplateModify(UserTemplateWithValidator):
    group_ids: list[int] | None = None

    @field_validator("group_ids", mode="after")
    @classmethod
    def group_ids_validator(cls, v):
        return ListValidator.nullable_list(v, "group")


class UserTemplateResponse(UserTemplate):
    id: int

    model_config = ConfigDict(from_attributes=True)

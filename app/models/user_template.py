import json
from pydantic import BaseModel, ConfigDict, Field, field_validator
from app.models.proxy import XTLSFlows, ShadowsocksMethods
from app.db.models import UserDataLimitResetStrategy, UserStatusCreate
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
    username_prefix: str | None = Field(max_length=20, min_length=1, default=None)
    username_suffix: str | None = Field(max_length=20, min_length=1, default=None)
    group_ids: list[int] = []
    extra_settings: ExtraSettings | None = None
    status: UserStatusCreate | None = None
    reset_usages: bool | None = None
    on_hold_timeout: int | None = None
    data_limit_reset_strategy: UserDataLimitResetStrategy | None = None


class UserTemplateWithValidator(UserTemplate):
    @field_validator("status", mode="before", check_fields=False)
    def validate_status(cls, status, values):
        return UserValidator.validate_status(status, values)


class UserTemplateCreate(UserTemplateWithValidator):
    model_config = ConfigDict(
        json_schema_extra={
            "example": {
                "name": "my template 1",
                "username_prefix": None,
                "username_suffix": None,
                "group_ids": [1, 3, 5],
                "data_limit": 0,
                "expire_duration": 0,
                "extra_settings": {"flow": "", "method": None},
                "status": "active",
                "reset_usages": True,
                "on_hold_timeout": 3600,
                "data_limit_reset_strategy": "no_reset",
            }
        }
    )

    @field_validator("group_ids", mode="after")
    @classmethod
    def group_ids_validator(cls, v):
        return ListValidator.not_null_list(v, "group")


class UserTemplateModify(UserTemplateWithValidator):
    group_ids: list[int] | None = None
    model_config = ConfigDict(
        json_schema_extra={
            "example": {
                "name": "my template 1",
                "username_prefix": None,
                "username_suffix": None,
                "group_ids": [1, 3, 5],
                "data_limit": 0,
                "expire_duration": 0,
                "extra_settings": {"flow": "", "method": None},
                "status": "active",
                "reset_usages": True,
                "on_hold_timeout": 3600,
                "data_limit_reset_strategy": "no_reset",
            }
        }
    )

    @field_validator("group_ids", mode="after")
    @classmethod
    def group_ids_validator(cls, v):
        return ListValidator.nullable_list(v, "group")


class UserTemplateResponse(UserTemplate):
    id: int

    model_config = ConfigDict(from_attributes=True)

from datetime import datetime as dt

from pydantic import BaseModel, ConfigDict, field_validator, Field


class CoreBase(BaseModel):
    name: str
    config: dict
    exclude_inbound_tags: str = Field(max_length=2048)
    fallbacks_inbound_tags: str = Field(max_length=2048)


class CoreCreate(CoreBase):
    name: str | None = Field(max_length=256, default=None)
    exclude_inbound_tags: str | None = None
    fallbacks_inbound_tags: str | None = None

    @field_validator("config", mode="before")
    def validate_config(cls, v: dict) -> dict:
        if not v:
            raise ValueError("config dictionary cannot be empty")
        return v


class CoreResponse(CoreBase):
    id: int
    created_at: dt

    model_config = ConfigDict(from_attributes=True)


class CoreResponseList(BaseModel):
    count: int
    cores: list[CoreResponse] = []

    model_config = ConfigDict(from_attributes=True)

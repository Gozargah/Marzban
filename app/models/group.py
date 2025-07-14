from pydantic import BaseModel, ConfigDict, Field, field_validator

from .validators import ListValidator


class Group(BaseModel):
    name: str = Field(min_length=3, max_length=64)
    inbound_tags: list[str] | None = []
    is_disabled: bool = False

    model_config = ConfigDict(from_attributes=True)


class GroupCreate(Group):
    inbound_tags: list[str]

    @field_validator("inbound_tags", mode="after")
    @classmethod
    def inbound_tags_validator(cls, v):
        return ListValidator.not_null_list(v, "inbound")


class GroupModify(Group):
    @field_validator("inbound_tags", mode="after")
    @classmethod
    def inbound_tags_validator(cls, v):
        return ListValidator.nullable_list(v, "inbound")


class GroupResponse(Group):
    id: int
    total_users: int = 0

    model_config = ConfigDict(from_attributes=True)


class GroupsResponse(BaseModel):
    groups: list[GroupResponse]
    total: int


class BulkGroup(BaseModel):
    group_ids: set[int]
    has_group_ids: set[int] = Field(default_factory=set)
    admins: set[int] = Field(default_factory=set)
    users: set[int] = Field(default_factory=set)

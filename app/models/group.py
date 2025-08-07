from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator

from .validators import ListValidator


class Group(BaseModel):
    name: str = Field(min_length=3, max_length=64)
    inbound_tags: list[str] | None = []
    host_ids: list[int] | None = []
    is_disabled: bool = False

    model_config = ConfigDict(from_attributes=True)


class GroupCreate(Group):
    inbound_tags: list[str]
    host_ids: list[int]

    @model_validator(mode="after")
    def validate_selection(self):
        """Validate that at least one inbound or host is selected"""
        ListValidator.validate_inbound_or_host_selection(self.inbound_tags, self.host_ids)
        return self


class GroupModify(Group):
    @model_validator(mode="after")
    def validate_selection(self):
        """Validate that at least one inbound or host is selected if both are provided"""
        if self.inbound_tags is not None and self.host_ids is not None:
            ListValidator.validate_inbound_or_host_selection(self.inbound_tags, self.host_ids)
        return self


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

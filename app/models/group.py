import re

from pydantic import BaseModel, ConfigDict, field_validator


GROUPNAME_REGEXP = re.compile(r"^(?=\w{3,64}\b)[a-zA-Z0-9]+(?:[a-zA-Z0-9]+)*$")


class Group(BaseModel):
    name: str
    inbound_tags: list[str] | None = []
    is_disabled: bool = False

    model_config = ConfigDict(
        from_attributes=True,
        json_schema_extra={
            "example": {
                "name": "group_1",
                "inbound_tags": ["VMess TCP", "VMess Websocket"],
            }
        },
    )

    @field_validator("name", mode="after")
    @classmethod
    def name_validate(cls, v):
        if not GROUPNAME_REGEXP.match(v):
            raise ValueError("Name only can be 3 to 64 characters and contain a-z, 0-9")
        return v


class GroupCreate(Group):
    inbound_tags: list[str] = []

    @field_validator("inbound_tags", mode="after")
    @classmethod
    def inbound_tags_validator(cls, v):
        if v and len(v) < 1:
            raise ValueError("you must select at least one inbound")
        return v


class GroupModify(Group):
    model_config = ConfigDict(
        json_schema_extra={
            "example": {
                "name": "group_1",
                "inbound_tags": ["VMess TCP", "VMess Websocket"],
            }
        }
    )


class GroupResponse(Group):
    id: int
    total_users: int = 0

    model_config = ConfigDict(from_attributes=True)


class GroupsResponse(BaseModel):
    groups: list[GroupResponse]
    total: int

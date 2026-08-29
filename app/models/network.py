from datetime import datetime
from typing import Dict, List, Optional

from pydantic import BaseModel, ConfigDict, Field, field_validator


class TunableResponse(BaseModel):
    """One kernel parameter, as the dashboard shows it."""

    key: str
    kind: str
    description: str
    # What the panel ships with, so the UI can mark a value as customised and
    # offer to put it back.
    baseline: str
    value: str
    customised: bool


class NetworkSection(BaseModel):
    id: str
    title: str
    settings: List[TunableResponse]


class NetworkInterface(BaseModel):
    """Read-only: the panel reports interfaces but never reconfigures them.

    Changing an address or an MTU from a web panel reachable over that same
    interface is a way to lose the server, so this is here to look at.
    """

    name: str
    mac: Optional[str] = None
    mtu: Optional[int] = None
    addresses: List[str] = []


class NetworkSettings(BaseModel):
    enabled: bool
    writable: bool
    # Why writing is unavailable, when it is.
    reason: Optional[str] = None
    managed_file: str
    sections: List[NetworkSection]
    interfaces: List[NetworkInterface] = []


class NetworkSettingsModify(BaseModel):
    settings: Dict[str, str] = Field(min_length=1)

    @field_validator("settings")
    @classmethod
    def strip_values(cls, settings):
        return {key: " ".join(str(value).split()) for key, value in settings.items()}


class TunableFailure(BaseModel):
    key: str
    message: str


class NetworkApplyResult(BaseModel):
    """What the kernel accepted, and what it refused and why."""

    applied: List[str]
    failed: List[TunableFailure] = []
    settings: NetworkSettings


class NetworkProfileResponse(BaseModel):
    id: int
    name: str
    description: Optional[str] = None
    builtin: bool
    settings: Dict[str, str]
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None
    model_config = ConfigDict(from_attributes=True)


class NetworkProfileCreate(BaseModel):
    name: str = Field(min_length=1, max_length=64)
    description: Optional[str] = Field(default=None, max_length=512)
    # Omitted means "whatever the system is running right now", which is how
    # the dashboard's "save current settings" button works.
    settings: Optional[Dict[str, str]] = None

    @field_validator("name")
    @classmethod
    def strip_name(cls, name):
        name = name.strip()
        if not name:
            raise ValueError("A profile needs a name.")
        return name


class NetworkProfileModify(BaseModel):
    name: Optional[str] = Field(default=None, max_length=64)
    description: Optional[str] = Field(default=None, max_length=512)
    settings: Optional[Dict[str, str]] = None

    @field_validator("name")
    @classmethod
    def strip_name(cls, name):
        if name is None:
            return None
        name = name.strip()
        if not name:
            raise ValueError("A profile needs a name.")
        return name


class ResourceLimit(BaseModel):
    """One rlimit of the panel process. A null value means unlimited."""

    name: str
    soft: Optional[int] = None
    hard: Optional[int] = None
    # None when the panel only reports this limit rather than raising it.
    target: Optional[int] = None
    managed: bool
    at_target: bool


class LimitsSnippet(BaseModel):
    """A file the host needs, and what has to restart before it counts."""

    path: str
    content: str
    restart: str


class ResourceLimits(BaseModel):
    enabled: bool
    # Why the host files cannot be written, when they cannot.
    reason: Optional[str] = None
    # The ceiling fs.nr_open puts on any process, and the value the panel aims for.
    kernel_ceiling: Optional[int] = None
    target: int
    limits: List[ResourceLimit]
    # Shown so an admin can apply by hand what the panel will not restart for them.
    snippets: List[LimitsSnippet]


class LimitsApplyResult(BaseModel):
    raised: List[str]
    written: List[LimitsSnippet] = []
    problems: List[str] = []
    limits: ResourceLimits

import re
from enum import Enum
from typing import Optional, Union

from app import xray
from app.models.proxy import ProxyTypes
from pydantic import BaseModel, ConfigDict, Field, field_validator

FRAGMENT_PATTERN = re.compile(r'^((\d{1,4}-\d{1,4})|(\d{1,4})),((\d{1,3}-\d{1,3})|(\d{1,3})),(tlshello|\d|\d\-\d)$')
NOISE_PATTERN = re.compile(
    r'^(rand:(\d{1,4}-\d{1,4}|\d{1,4})|str:.+|base64:.+)(,(\d{1,4}-\d{1,4}|\d{1,4}))?(&(rand:(\d{1,4}-\d{1,4}|\d{1,4})|str:.+|base64:.+)(,(\d{1,4}-\d{1,4}|\d{1,4}))?)*$')


class ProxyHostSecurity(str, Enum):
    inbound_default = "inbound_default"
    none = "none"
    tls = "tls"


ProxyHostALPN = Enum(
    "ProxyHostALPN",
    {
        "none": "",
        "h3": "h3",
        "h2": "h2",
        "http/1.1": "http/1.1",
        "h3,h2,http/1.1": "h3,h2,http/1.1",
        "h3,h2": "h3,h2",
        "h2,http/1.1": "h2,http/1.1",
    },
)
ProxyHostFingerprint = Enum(
    "ProxyHostFingerprint",
    {
        "none": "",
        "chrome": "chrome",
        "firefox": "firefox",
        "safari": "safari",
        "ios": "ios",
        "android": "android",
        "edge": "edge",
        "360": "360",
        "qq": "qq",
        "random": "random",
        "randomized": "randomized",
    },
)


class FormatVariables(dict):
    def __missing__(self, key):
        return key.join("{}")


class BaseHost(BaseModel):
    remark: str
    address: str
    inbound_tag: str
    port: Optional[int] = Field(None, nullable=True)
    sni: Optional[str] = Field(None, nullable=True)
    host: Optional[str] = Field(None, nullable=True)
    path: Optional[str] = Field(None, nullable=True)
    security: ProxyHostSecurity = ProxyHostSecurity.inbound_default
    alpn: ProxyHostALPN = ProxyHostALPN.none
    fingerprint: ProxyHostFingerprint = ProxyHostFingerprint.none
    allowinsecure: Union[bool, None] = None
    is_disabled: Union[bool, None] = None
    mux_enable: Union[bool, None] = None
    fragment_setting: Optional[str] = Field(None, nullable=True)
    random_user_agent: Union[bool, None] = None
    noise_setting: Optional[str] = Field(None, nullable=True)
    use_sni_as_host: Union[bool, None] = None

    model_config = ConfigDict(from_attributes=True)
 

class CreateHost(BaseHost):
    @field_validator("remark", mode="after")
    def validate_remark(cls, v):
        try:
            v.format_map(FormatVariables())
        except ValueError as exc:
            raise ValueError("Invalid formatting variables")

        return v
    
    @field_validator("inbound_tag", mode="after")
    def validate_inbound(cls, v):
        if xray.config.get_inbound(v) is None:
            raise ValueError(f"Inbound {v} doesn't exist")
        return v

    @field_validator("address", mode="after")
    def validate_address(cls, v):
        try:
            v.format_map(FormatVariables())
        except ValueError as exc:
            raise ValueError("Invalid formatting variables")

        return v

    @field_validator("fragment_setting", check_fields=False)
    @classmethod
    def validate_fragment(cls, v):
        if v and not FRAGMENT_PATTERN.match(v):
            raise ValueError(
                "Fragment setting must be like this: length,interval,packet (10-100,100-200,tlshello)."
            )
        return v

    @field_validator("noise_setting", check_fields=False)
    @classmethod
    def validate_noise(cls, v):
        if v:
            if not NOISE_PATTERN.match(v):
                raise ValueError(
                    "Noise setting must be like this: packet,delay (rand:10-20,100-200)."
                )
            if len(v) > 2000:
                raise ValueError(
                    "Noise can't be longer that 2000 character"
                )
        return v


class HostResponse(BaseHost):
    id: int

    model_config = ConfigDict(from_attributes=True)


class ProxyInbound(BaseModel):
    tag: str
    protocol: ProxyTypes
    network: str
    tls: str
    port: Union[int, str]

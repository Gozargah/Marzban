import json
import re
from enum import Enum
from typing import List, Literal, Optional, Union
from uuid import UUID, uuid4

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator

from app.utils.system import random_password
from xray_api.types.account import (
    ShadowsocksAccount,
    ShadowsocksMethods,
    TrojanAccount,
    VLESSAccount,
    VMessAccount,
    XTLSFlows,
)

FRAGMENT_PATTERN = re.compile(r'^((\d{1,4}-\d{1,4})|(\d{1,4})),((\d{1,3}-\d{1,3})|(\d{1,3})),(tlshello|\d|\d\-\d)$')

NOISE_PATTERN = re.compile(
    r'^(rand:(\d{1,4}-\d{1,4}|\d{1,4})|str:.+|hex:.+|base64:.+)(,(\d{1,4}-\d{1,4}|\d{1,4}))?(&(rand:(\d{1,4}-\d{1,4}|\d{1,4})|str:.+|hex:.+|base64:.+)(,(\d{1,4}-\d{1,4}|\d{1,4}))?)*$')


class ProxyTypes(str, Enum):
    # proxy_type = protocol

    VMess = "vmess"
    VLESS = "vless"
    Trojan = "trojan"
    Shadowsocks = "shadowsocks"

    @property
    def account_model(self):
        if self == self.VMess:
            return VMessAccount
        if self == self.VLESS:
            return VLESSAccount
        if self == self.Trojan:
            return TrojanAccount
        if self == self.Shadowsocks:
            return ShadowsocksAccount

    @property
    def settings_model(self):
        if self == self.VMess:
            return VMessSettings
        if self == self.VLESS:
            return VLESSSettings
        if self == self.Trojan:
            return TrojanSettings
        if self == self.Shadowsocks:
            return ShadowsocksSettings


class ProxySettings(BaseModel, use_enum_values=True):
    @classmethod
    def from_dict(cls, proxy_type: ProxyTypes, _dict: dict):
        return ProxyTypes(proxy_type).settings_model.model_validate(_dict)

    def dict(self, *, no_obj=False, **kwargs):
        if no_obj:
            return json.loads(self.json())
        return super().dict(**kwargs)


class VMessSettings(ProxySettings):
    id: UUID = Field(default_factory=uuid4)

    def revoke(self):
        self.id = uuid4()


class VLESSSettings(ProxySettings):
    id: UUID = Field(default_factory=uuid4)
    flow: XTLSFlows = XTLSFlows.NONE

    def revoke(self):
        self.id = uuid4()


class TrojanSettings(ProxySettings):
    password: str = Field(default_factory=random_password)
    flow: XTLSFlows = XTLSFlows.NONE

    def revoke(self):
        self.password = random_password()


class ShadowsocksSettings(ProxySettings):
    password: str = Field(default_factory=random_password)
    method: ShadowsocksMethods = ShadowsocksMethods.CHACHA20_POLY1305

    def revoke(self):
        self.password = random_password()


class ProxyHostSecurity(str, Enum):
    inbound_default = "inbound_default"
    none = "none"
    tls = "tls"
    reality = "reality"


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


class HostTLSExtra(BaseModel):
    ech_config_list: Optional[str] = None
    ech_force_query: Optional[Literal["none", "half", "full"]] = None
    pinned_peer_cert_sha256: List[str] = Field(default_factory=list)
    verify_peer_cert_by_name: List[str] = Field(default_factory=list)

    @field_validator("pinned_peer_cert_sha256")
    @classmethod
    def validate_pins(cls, v):
        for pin in v:
            if not re.fullmatch(r"[0-9a-fA-F]{64}", pin):
                raise ValueError("Pinned certificate must be a 64-character hex SHA256")
        return [pin.lower() for pin in v]


class HostRealityExtra(BaseModel):
    public_key: str
    short_id: str = ""
    spider_x: Optional[str] = None

    @field_validator("short_id")
    @classmethod
    def validate_short_id(cls, v):
        if v and not re.fullmatch(r"(?:[0-9a-fA-F]{2}){1,8}", v):
            raise ValueError("Short ID must be 2-16 hex characters (even length)")
        return v


class HostXmux(BaseModel):
    max_concurrency: Optional[str] = None
    max_connections: Optional[str] = None
    c_max_reuse_times: Optional[str] = None
    h_max_request_times: Optional[str] = None
    h_max_reusable_secs: Optional[str] = None
    h_keep_alive_period: Optional[int] = None


class HostXhttpExtra(BaseModel):
    mode: Optional[Literal["auto", "packet-up", "stream-up", "stream-one"]] = None
    x_padding_bytes: Optional[str] = None
    sc_max_each_post_bytes: Optional[str] = None
    no_grpc_header: Optional[bool] = None
    xmux: Optional[HostXmux] = None


class HostMuxSettings(BaseModel):
    enabled: bool = False
    concurrency: Optional[int] = Field(None, ge=-1, le=1024)
    xudp_concurrency: Optional[int] = Field(None, ge=-1, le=1024)
    xudp_proxy_udp443: Optional[Literal["reject", "allow", "skip"]] = None


class ProxyHost(BaseModel):
    remark: str
    address: str
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
    noise_setting: Optional[str] = Field(None, nullable=True)
    random_user_agent: Union[bool, None] = None
    use_sni_as_host: Union[bool, None] = None
    tls_extra: Optional[HostTLSExtra] = None
    reality_extra: Optional[HostRealityExtra] = None
    xhttp_extra: Optional[HostXhttpExtra] = None
    mux_settings: Optional[HostMuxSettings] = None
    model_config = ConfigDict(from_attributes=True)

    @model_validator(mode="after")
    def validate_security_extras(self):
        if self.security == ProxyHostSecurity.reality and not self.reality_extra:
            raise ValueError("reality_extra is required when security is reality")
        return self

    @field_validator("remark", mode="after")
    def validate_remark(cls, v):
        try:
            v.format_map(FormatVariables())
        except ValueError as exc:
            raise ValueError("Invalid formatting variables")

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


class ProxyInbound(BaseModel):
    tag: str
    protocol: ProxyTypes
    network: str
    tls: str
    port: Union[int, str]
    usage_coefficient: float = 1.0


class InboundUsageCoefficient(BaseModel):
    usage_coefficient: float = Field(gt=0, le=100)

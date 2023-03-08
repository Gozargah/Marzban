import json
from enum import Enum
from typing import List, Union
from uuid import UUID, uuid4

from app.utils.system import random_password
from pydantic import BaseModel, Field
from xray_api.types.account import (ShadowsocksAccount, TrojanAccount,
                                    VLESSAccount, VMessAccount)


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


class ProxyHostSecurity(str, Enum):
    inbound_default = "inbound_default"
    none = "none"
    tls = "tls"


class ProxySettings(BaseModel):
    @classmethod
    def from_dict(cls, proxy_type: ProxyTypes, _dict: dict):
        return ProxyTypes(proxy_type).settings_model.parse_obj(_dict)

    def dict(self, *, no_obj=False, **kwargs):
        if no_obj:
            return json.loads(self.json())
        return super().dict(**kwargs)


class VMessSettings(ProxySettings):
    id: UUID = Field(default_factory=uuid4)


class VLESSSettings(ProxySettings):
    id: UUID = Field(default_factory=uuid4)
    flow: str = ""


class TrojanSettings(ProxySettings):
    password: str = Field(default_factory=random_password)


class ShadowsocksSettings(ProxySettings):
    password: str = Field(default_factory=random_password)


class ProxyHost(BaseModel):
    remark: str
    address: str
    port: Union[int, None] = None
    sni: str = ""
    host: str = ""
    security: ProxyHostSecurity = ProxyHostSecurity.inbound_default

    class Config:
        orm_mode = True


class ProxyInbound(BaseModel):
    tag: str
    protocol: ProxyTypes
    network: str
    tls: bool
    port: int

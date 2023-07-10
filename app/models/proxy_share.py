import urllib.parse as urlparse
import json
from base64 import b64encode
from typing import Union
from uuid import UUID

from pydantic import BaseModel, Field


class ProxyShare(BaseModel):
    def dump_link(self) -> str:
        pass


class VMessAEAD(ProxyShare):
    protocol: str = 'protocol'

    id: str

    remark: str
    address: str
    port: int
    type: str

    path: str = None
    host: str = None
    headerType: str = Field(None, alias='header_type')
    flow: str = None
    security: str = None
    sni: str = None
    fp: str = None
    alpn: str = None
    pbk: str = None
    sid: str = None
    spx: str = None

    def dump_link(self) -> str:
        query_params = self.dict(exclude={'remark', 'id', 'address', 'port'}, exclude_none=True)
        if self.type == 'grpc':
            query_params['serviceName'] = self.path
            del query_params['path']

        urlencoded_params = urlparse.urlencode(query_params, safe=',/')
        return f'{self.protocol}://{self.id}@{self.address}:{self.port}' \
               f'?{urlencoded_params}#{self.remark}'


class VLESS(VMessAEAD):
    protocol = 'vless'
    id: Union[str, UUID]
    type = 'ws'


class Trojan(VMessAEAD):
    protocol = 'trojan'
    id: str = Field(alias='password')
    type = 'tcp'


class VMessQRCode(ProxyShare):
    v: int = 2
    ps: str = Field(None, alias='remark')
    add: str = Field(alias='address')
    port: int
    id: str
    aid: str = '0'
    scy: str = 'auto'
    net: str = Field(alias='network')
    type: str = Field(alias='header_type')
    host: str = None
    path: str = None
    tls: str = None
    sni: str = None
    alpn: str = None
    fp: str = None
    pbk: str = None
    sid: str = None
    spx: str = None

    def dump_link(self) -> str:
        params = self.dict(exclude_none=True)

        return 'vmess://' + b64encode(json.dumps(params, sort_keys=True).encode('utf-8')).decode()


class Shadowsocks(ProxyShare):
    remark: str
    address: str
    port: int
    password: str
    security = 'chacha20-ietf-poly1305'

    def dump_link(self) -> str:
        authenticator = b64encode(f'{self.security}:{self.password}'.encode()).decode()

        return f'ss://{authenticator}@{self.address}:{self.port}#{urlparse.quote(self.remark)}'


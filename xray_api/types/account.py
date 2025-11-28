from abc import ABC, abstractmethod
from enum import Enum
from uuid import UUID

from pydantic import BaseModel

from ..proto.common.serial.typed_message_pb2 import TypedMessage
from ..proto.proxy.shadowsocks.config_pb2 import \
    Account as ShadowsocksAccountPb2
from ..proto.proxy.shadowsocks.config_pb2 import \
    CipherType as ShadowsocksCiphers
from ..proto.proxy.trojan.config_pb2 import Account as TrojanAccountPb2
from ..proto.proxy.vless.account_pb2 import Account as VLESSAccountPb2
from ..proto.proxy.vmess.account_pb2 import Account as VMessAccountPb2
from .message import Message
from ..proto.common.serial.typed_message_pb2 import TypedMessage


class Account(BaseModel, ABC):
    email: str
    level: int = 0

    @property
    @abstractmethod
    def message(self):
        pass

    def __repr__(self) -> str:
        return f"<{self.__class__.__name__} {self.email}>"


class VMessAccount(Account):
    id: UUID

    @property
    def message(self):
        return Message(VMessAccountPb2(id=str(self.id)))


class XTLSFlows(Enum):
    NONE = ''
    VISION = 'xtls-rprx-vision'


class VLESSAccount(Account):
    id: UUID
    flow: XTLSFlows = XTLSFlows.NONE

    @property
    def message(self):
        return Message(VLESSAccountPb2(id=str(self.id), flow=self.flow.value))


class TrojanAccount(Account):
    password: str
    flow: XTLSFlows = XTLSFlows.NONE

    @property
    def message(self):
        return Message(TrojanAccountPb2(password=self.password))


class ShadowsocksMethods(str, Enum):
    AES_128_GCM = 'aes-128-gcm'
    AES_256_GCM = 'aes-256-gcm'
    CHACHA20_POLY1305 = 'chacha20-ietf-poly1305'

    SS_2022_BLAKE3_AES_128_GCM = '2022-blake3-aes-128-gcm'
    SS_2022_BLAKE3_AES_256_GCM = '2022-blake3-aes-256-gcm'
    SS_2022_BLAKE3_CHACHA20_POLY1305 = '2022-blake3-chacha20-poly1305'


class ShadowsocksAccount(Account):
    password: str
    method: ShadowsocksMethods = ShadowsocksMethods.CHACHA20_POLY1305

    @property
    def cipher_type(self):
        if self.method.value.startswith('2022-'):
            raise ValueError('Use Shadowsocks2022Account for 2022 methods')
        return self.method.name

    @property
    def message(self):
        return Message(ShadowsocksAccountPb2(password=self.password, cipher_type=self.cipher_type))


class Shadowsocks2022Account(Account):
    key: str
    method: str

    @property
    def message(self):
        # SS2022 AddUser in xray-core expects account type "xray.proxy.shadowsocks_2022.Account"
        # with a single string field `key` (field number 1). Build the wire payload manually
        # to avoid depending on mismatched/generated proto stubs.
        def _varint(n: int) -> bytes:
            out = bytearray()
            while True:
                to_write = n & 0x7F
                n >>= 7
                if n:
                    out.append(0x80 | to_write)
                else:
                    out.append(to_write)
                    break
            return bytes(out)

        key_bytes = self.key.encode("utf-8")
        # field 1, wire type 2 (length‑delimited) -> tag 0x0A
        payload = b"\x0a" + _varint(len(key_bytes)) + key_bytes
        return TypedMessage(
            type="xray.proxy.shadowsocks_2022.Account",
            value=payload,
        )

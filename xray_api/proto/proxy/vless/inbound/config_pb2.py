# -*- coding: utf-8 -*-
# Generated by the protocol buffer compiler.  DO NOT EDIT!
# source: proxy/vless/inbound/config.proto
"""Generated protocol buffer code."""

from google.protobuf import descriptor as _descriptor
from google.protobuf import descriptor_pool as _descriptor_pool
from google.protobuf import message as _message
from google.protobuf import reflection as _reflection
from google.protobuf import symbol_database as _symbol_database
# @@protoc_insertion_point(imports)

_sym_db = _symbol_database.Default()


from xray_api.proto.common.protocol import user_pb2 as common_dot_protocol_dot_user__pb2


DESCRIPTOR = _descriptor_pool.Default().AddSerializedFile(
    b'\n proxy/vless/inbound/config.proto\x12\x18xray.proxy.vless.inbound\x1a\x1a\x63ommon/protocol/user.proto"^\n\x08\x46\x61llback\x12\x0c\n\x04name\x18\x01 \x01(\t\x12\x0c\n\x04\x61lpn\x18\x02 \x01(\t\x12\x0c\n\x04path\x18\x03 \x01(\t\x12\x0c\n\x04type\x18\x04 \x01(\t\x12\x0c\n\x04\x64\x65st\x18\x05 \x01(\t\x12\x0c\n\x04xver\x18\x06 \x01(\x04"\x80\x01\n\x06\x43onfig\x12+\n\x07\x63lients\x18\x01 \x03(\x0b\x32\x1a.xray.common.protocol.User\x12\x12\n\ndecryption\x18\x02 \x01(\t\x12\x35\n\tfallbacks\x18\x03 \x03(\x0b\x32".xray.proxy.vless.inbound.FallbackBj\n\x1c\x63om.xray.proxy.vless.inboundP\x01Z-github.com/xtls/xray-core/proxy/vless/inbound\xaa\x02\x18Xray.Proxy.Vless.Inboundb\x06proto3'
)


_FALLBACK = DESCRIPTOR.message_types_by_name["Fallback"]
_CONFIG = DESCRIPTOR.message_types_by_name["Config"]
Fallback = _reflection.GeneratedProtocolMessageType(
    "Fallback",
    (_message.Message,),
    {
        "DESCRIPTOR": _FALLBACK,
        "__module__": "proxy.vless.inbound.config_pb2",
        # @@protoc_insertion_point(class_scope:xray.proxy.vless.inbound.Fallback)
    },
)
_sym_db.RegisterMessage(Fallback)

Config = _reflection.GeneratedProtocolMessageType(
    "Config",
    (_message.Message,),
    {
        "DESCRIPTOR": _CONFIG,
        "__module__": "proxy.vless.inbound.config_pb2",
        # @@protoc_insertion_point(class_scope:xray.proxy.vless.inbound.Config)
    },
)
_sym_db.RegisterMessage(Config)

if _descriptor._USE_C_DESCRIPTORS == False:
    DESCRIPTOR._options = None
    DESCRIPTOR._serialized_options = b"\n\034com.xray.proxy.vless.inboundP\001Z-github.com/xtls/xray-core/proxy/vless/inbound\252\002\030Xray.Proxy.Vless.Inbound"
    _FALLBACK._serialized_start = 90
    _FALLBACK._serialized_end = 184
    _CONFIG._serialized_start = 187
    _CONFIG._serialized_end = 315
# @@protoc_insertion_point(module_scope)

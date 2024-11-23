# -*- coding: utf-8 -*-
# Generated by the protocol buffer compiler.  DO NOT EDIT!
# source: proxy/mtproto/config.proto
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
    b'\n\x1aproxy/mtproto/config.proto\x12\x12xray.proxy.mtproto\x1a\x1a\x63ommon/protocol/user.proto"\x19\n\x07\x41\x63\x63ount\x12\x0e\n\x06secret\x18\x01 \x01(\x0c"8\n\x0cServerConfig\x12(\n\x04user\x18\x01 \x03(\x0b\x32\x1a.xray.common.protocol.User"\x0e\n\x0c\x43lientConfigBX\n\x16\x63om.xray.proxy.mtprotoP\x01Z\'github.com/xtls/xray-core/proxy/mtproto\xaa\x02\x12Xray.Proxy.Mtprotob\x06proto3'
)


_ACCOUNT = DESCRIPTOR.message_types_by_name["Account"]
_SERVERCONFIG = DESCRIPTOR.message_types_by_name["ServerConfig"]
_CLIENTCONFIG = DESCRIPTOR.message_types_by_name["ClientConfig"]
Account = _reflection.GeneratedProtocolMessageType(
    "Account",
    (_message.Message,),
    {
        "DESCRIPTOR": _ACCOUNT,
        "__module__": "proxy.mtproto.config_pb2",
        # @@protoc_insertion_point(class_scope:xray.proxy.mtproto.Account)
    },
)
_sym_db.RegisterMessage(Account)

ServerConfig = _reflection.GeneratedProtocolMessageType(
    "ServerConfig",
    (_message.Message,),
    {
        "DESCRIPTOR": _SERVERCONFIG,
        "__module__": "proxy.mtproto.config_pb2",
        # @@protoc_insertion_point(class_scope:xray.proxy.mtproto.ServerConfig)
    },
)
_sym_db.RegisterMessage(ServerConfig)

ClientConfig = _reflection.GeneratedProtocolMessageType(
    "ClientConfig",
    (_message.Message,),
    {
        "DESCRIPTOR": _CLIENTCONFIG,
        "__module__": "proxy.mtproto.config_pb2",
        # @@protoc_insertion_point(class_scope:xray.proxy.mtproto.ClientConfig)
    },
)
_sym_db.RegisterMessage(ClientConfig)

if _descriptor._USE_C_DESCRIPTORS == False:
    DESCRIPTOR._options = None
    DESCRIPTOR._serialized_options = (
        b"\n\026com.xray.proxy.mtprotoP\001Z'github.com/xtls/xray-core/proxy/mtproto\252\002\022Xray.Proxy.Mtproto"
    )
    _ACCOUNT._serialized_start = 78
    _ACCOUNT._serialized_end = 103
    _SERVERCONFIG._serialized_start = 105
    _SERVERCONFIG._serialized_end = 161
    _CLIENTCONFIG._serialized_start = 163
    _CLIENTCONFIG._serialized_end = 177
# @@protoc_insertion_point(module_scope)

# -*- coding: utf-8 -*-
# Generated by the protocol buffer compiler.  DO NOT EDIT!
# source: transport/internet/grpc/config.proto
"""Generated protocol buffer code."""

from google.protobuf import descriptor as _descriptor
from google.protobuf import descriptor_pool as _descriptor_pool
from google.protobuf import message as _message
from google.protobuf import reflection as _reflection
from google.protobuf import symbol_database as _symbol_database
# @@protoc_insertion_point(imports)

_sym_db = _symbol_database.Default()


DESCRIPTOR = _descriptor_pool.Default().AddSerializedFile(
    b'\n$transport/internet/grpc/config.proto\x12%xray.transport.internet.grpc.encoding"\xca\x01\n\x06\x43onfig\x12\x11\n\tauthority\x18\x01 \x01(\t\x12\x14\n\x0cservice_name\x18\x02 \x01(\t\x12\x12\n\nmulti_mode\x18\x03 \x01(\x08\x12\x14\n\x0cidle_timeout\x18\x04 \x01(\x05\x12\x1c\n\x14health_check_timeout\x18\x05 \x01(\x05\x12\x1d\n\x15permit_without_stream\x18\x06 \x01(\x08\x12\x1c\n\x14initial_windows_size\x18\x07 \x01(\x05\x12\x12\n\nuser_agent\x18\x08 \x01(\tB3Z1github.com/xtls/xray-core/transport/internet/grpcb\x06proto3'
)


_CONFIG = DESCRIPTOR.message_types_by_name["Config"]
Config = _reflection.GeneratedProtocolMessageType(
    "Config",
    (_message.Message,),
    {
        "DESCRIPTOR": _CONFIG,
        "__module__": "transport.internet.grpc.config_pb2",
        # @@protoc_insertion_point(class_scope:xray.transport.internet.grpc.encoding.Config)
    },
)
_sym_db.RegisterMessage(Config)

if _descriptor._USE_C_DESCRIPTORS == False:
    DESCRIPTOR._options = None
    DESCRIPTOR._serialized_options = (
        b"Z1github.com/xtls/xray-core/transport/internet/grpc"
    )
    _CONFIG._serialized_start = 80
    _CONFIG._serialized_end = 282
# @@protoc_insertion_point(module_scope)

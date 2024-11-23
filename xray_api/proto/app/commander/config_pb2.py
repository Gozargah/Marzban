# -*- coding: utf-8 -*-
# Generated by the protocol buffer compiler.  DO NOT EDIT!
# source: app/commander/config.proto
"""Generated protocol buffer code."""

from google.protobuf import descriptor as _descriptor
from google.protobuf import descriptor_pool as _descriptor_pool
from google.protobuf import message as _message
from google.protobuf import reflection as _reflection
from google.protobuf import symbol_database as _symbol_database
# @@protoc_insertion_point(imports)

_sym_db = _symbol_database.Default()


from xray_api.proto.common.serial import (
    typed_message_pb2 as common_dot_serial_dot_typed__message__pb2,
)


DESCRIPTOR = _descriptor_pool.Default().AddSerializedFile(
    b'\n\x1a\x61pp/commander/config.proto\x12\x12xray.app.commander\x1a!common/serial/typed_message.proto"X\n\x06\x43onfig\x12\x0b\n\x03tag\x18\x01 \x01(\t\x12\x0e\n\x06listen\x18\x03 \x01(\t\x12\x31\n\x07service\x18\x02 \x03(\x0b\x32 .xray.common.serial.TypedMessage"\x12\n\x10ReflectionConfigBX\n\x16\x63om.xray.app.commanderP\x01Z\'github.com/xtls/xray-core/app/commander\xaa\x02\x12Xray.App.Commanderb\x06proto3'
)


_CONFIG = DESCRIPTOR.message_types_by_name["Config"]
_REFLECTIONCONFIG = DESCRIPTOR.message_types_by_name["ReflectionConfig"]
Config = _reflection.GeneratedProtocolMessageType(
    "Config",
    (_message.Message,),
    {
        "DESCRIPTOR": _CONFIG,
        "__module__": "app.commander.config_pb2",
        # @@protoc_insertion_point(class_scope:xray.app.commander.Config)
    },
)
_sym_db.RegisterMessage(Config)

ReflectionConfig = _reflection.GeneratedProtocolMessageType(
    "ReflectionConfig",
    (_message.Message,),
    {
        "DESCRIPTOR": _REFLECTIONCONFIG,
        "__module__": "app.commander.config_pb2",
        # @@protoc_insertion_point(class_scope:xray.app.commander.ReflectionConfig)
    },
)
_sym_db.RegisterMessage(ReflectionConfig)

if _descriptor._USE_C_DESCRIPTORS == False:
    DESCRIPTOR._options = None
    DESCRIPTOR._serialized_options = (
        b"\n\026com.xray.app.commanderP\001Z'github.com/xtls/xray-core/app/commander\252\002\022Xray.App.Commander"
    )
    _CONFIG._serialized_start = 85
    _CONFIG._serialized_end = 173
    _REFLECTIONCONFIG._serialized_start = 175
    _REFLECTIONCONFIG._serialized_end = 193
# @@protoc_insertion_point(module_scope)

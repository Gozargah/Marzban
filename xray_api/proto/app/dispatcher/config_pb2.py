# -*- coding: utf-8 -*-
# Generated by the protocol buffer compiler.  DO NOT EDIT!
# source: app/dispatcher/config.proto
"""Generated protocol buffer code."""

from google.protobuf import descriptor as _descriptor
from google.protobuf import descriptor_pool as _descriptor_pool
from google.protobuf import message as _message
from google.protobuf import reflection as _reflection
from google.protobuf import symbol_database as _symbol_database
# @@protoc_insertion_point(imports)

_sym_db = _symbol_database.Default()


DESCRIPTOR = _descriptor_pool.Default().AddSerializedFile(
    b'\n\x1b\x61pp/dispatcher/config.proto\x12\x13xray.app.dispatcher"\x15\n\rSessionConfigJ\x04\x08\x01\x10\x02">\n\x06\x43onfig\x12\x34\n\x08settings\x18\x01 \x01(\x0b\x32".xray.app.dispatcher.SessionConfigB[\n\x17\x63om.xray.app.dispatcherP\x01Z(github.com/xtls/xray-core/app/dispatcher\xaa\x02\x13Xray.App.Dispatcherb\x06proto3'
)


_SESSIONCONFIG = DESCRIPTOR.message_types_by_name["SessionConfig"]
_CONFIG = DESCRIPTOR.message_types_by_name["Config"]
SessionConfig = _reflection.GeneratedProtocolMessageType(
    "SessionConfig",
    (_message.Message,),
    {
        "DESCRIPTOR": _SESSIONCONFIG,
        "__module__": "app.dispatcher.config_pb2",
        # @@protoc_insertion_point(class_scope:xray.app.dispatcher.SessionConfig)
    },
)
_sym_db.RegisterMessage(SessionConfig)

Config = _reflection.GeneratedProtocolMessageType(
    "Config",
    (_message.Message,),
    {
        "DESCRIPTOR": _CONFIG,
        "__module__": "app.dispatcher.config_pb2",
        # @@protoc_insertion_point(class_scope:xray.app.dispatcher.Config)
    },
)
_sym_db.RegisterMessage(Config)

if _descriptor._USE_C_DESCRIPTORS == False:
    DESCRIPTOR._options = None
    DESCRIPTOR._serialized_options = b"\n\027com.xray.app.dispatcherP\001Z(github.com/xtls/xray-core/app/dispatcher\252\002\023Xray.App.Dispatcher"
    _SESSIONCONFIG._serialized_start = 52
    _SESSIONCONFIG._serialized_end = 73
    _CONFIG._serialized_start = 75
    _CONFIG._serialized_end = 137
# @@protoc_insertion_point(module_scope)

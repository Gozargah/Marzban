# -*- coding: utf-8 -*-
# Generated by the protocol buffer compiler.  DO NOT EDIT!
# source: app/log/command/config.proto
"""Generated protocol buffer code."""

from google.protobuf import descriptor as _descriptor
from google.protobuf import descriptor_pool as _descriptor_pool
from google.protobuf import message as _message
from google.protobuf import reflection as _reflection
from google.protobuf import symbol_database as _symbol_database
# @@protoc_insertion_point(imports)

_sym_db = _symbol_database.Default()


DESCRIPTOR = _descriptor_pool.Default().AddSerializedFile(
    b'\n\x1c\x61pp/log/command/config.proto\x12\x14xray.app.log.command"\x08\n\x06\x43onfig"\x16\n\x14RestartLoggerRequest"\x17\n\x15RestartLoggerResponse2{\n\rLoggerService\x12j\n\rRestartLogger\x12*.xray.app.log.command.RestartLoggerRequest\x1a+.xray.app.log.command.RestartLoggerResponse"\x00\x42^\n\x18\x63om.xray.app.log.commandP\x01Z)github.com/xtls/xray-core/app/log/command\xaa\x02\x14Xray.App.Log.Commandb\x06proto3'
)


_CONFIG = DESCRIPTOR.message_types_by_name["Config"]
_RESTARTLOGGERREQUEST = DESCRIPTOR.message_types_by_name["RestartLoggerRequest"]
_RESTARTLOGGERRESPONSE = DESCRIPTOR.message_types_by_name["RestartLoggerResponse"]
Config = _reflection.GeneratedProtocolMessageType(
    "Config",
    (_message.Message,),
    {
        "DESCRIPTOR": _CONFIG,
        "__module__": "app.log.command.config_pb2",
        # @@protoc_insertion_point(class_scope:xray.app.log.command.Config)
    },
)
_sym_db.RegisterMessage(Config)

RestartLoggerRequest = _reflection.GeneratedProtocolMessageType(
    "RestartLoggerRequest",
    (_message.Message,),
    {
        "DESCRIPTOR": _RESTARTLOGGERREQUEST,
        "__module__": "app.log.command.config_pb2",
        # @@protoc_insertion_point(class_scope:xray.app.log.command.RestartLoggerRequest)
    },
)
_sym_db.RegisterMessage(RestartLoggerRequest)

RestartLoggerResponse = _reflection.GeneratedProtocolMessageType(
    "RestartLoggerResponse",
    (_message.Message,),
    {
        "DESCRIPTOR": _RESTARTLOGGERRESPONSE,
        "__module__": "app.log.command.config_pb2",
        # @@protoc_insertion_point(class_scope:xray.app.log.command.RestartLoggerResponse)
    },
)
_sym_db.RegisterMessage(RestartLoggerResponse)

_LOGGERSERVICE = DESCRIPTOR.services_by_name["LoggerService"]
if _descriptor._USE_C_DESCRIPTORS == False:
    DESCRIPTOR._options = None
    DESCRIPTOR._serialized_options = b"\n\030com.xray.app.log.commandP\001Z)github.com/xtls/xray-core/app/log/command\252\002\024Xray.App.Log.Command"
    _CONFIG._serialized_start = 54
    _CONFIG._serialized_end = 62
    _RESTARTLOGGERREQUEST._serialized_start = 64
    _RESTARTLOGGERREQUEST._serialized_end = 86
    _RESTARTLOGGERRESPONSE._serialized_start = 88
    _RESTARTLOGGERRESPONSE._serialized_end = 111
    _LOGGERSERVICE._serialized_start = 113
    _LOGGERSERVICE._serialized_end = 236
# @@protoc_insertion_point(module_scope)

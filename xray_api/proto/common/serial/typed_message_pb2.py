# -*- coding: utf-8 -*-
# Generated by the protocol buffer compiler.  DO NOT EDIT!
# source: common/serial/typed_message.proto
"""Generated protocol buffer code."""

from google.protobuf import descriptor as _descriptor
from google.protobuf import descriptor_pool as _descriptor_pool
from google.protobuf import message as _message
from google.protobuf import reflection as _reflection
from google.protobuf import symbol_database as _symbol_database
# @@protoc_insertion_point(imports)

_sym_db = _symbol_database.Default()


DESCRIPTOR = _descriptor_pool.Default().AddSerializedFile(
    b"\n!common/serial/typed_message.proto\x12\x12xray.common.serial\"+\n\x0cTypedMessage\x12\x0c\n\x04type\x18\x01 \x01(\t\x12\r\n\x05value\x18\x02 \x01(\x0c\x42X\n\x16\x63om.xray.common.serialP\x01Z'github.com/xtls/xray-core/common/serial\xaa\x02\x12Xray.Common.Serialb\x06proto3"
)


_TYPEDMESSAGE = DESCRIPTOR.message_types_by_name["TypedMessage"]
TypedMessage = _reflection.GeneratedProtocolMessageType(
    "TypedMessage",
    (_message.Message,),
    {
        "DESCRIPTOR": _TYPEDMESSAGE,
        "__module__": "common.serial.typed_message_pb2",
        # @@protoc_insertion_point(class_scope:xray.common.serial.TypedMessage)
    },
)
_sym_db.RegisterMessage(TypedMessage)

if _descriptor._USE_C_DESCRIPTORS == False:
    DESCRIPTOR._options = None
    DESCRIPTOR._serialized_options = b"\n\026com.xray.common.serialP\001Z'github.com/xtls/xray-core/common/serial\252\002\022Xray.Common.Serial"
    _TYPEDMESSAGE._serialized_start = 57
    _TYPEDMESSAGE._serialized_end = 100
# @@protoc_insertion_point(module_scope)

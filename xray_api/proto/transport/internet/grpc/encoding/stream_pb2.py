# -*- coding: utf-8 -*-
# Generated by the protocol buffer compiler.  DO NOT EDIT!
# source: transport/internet/grpc/encoding/stream.proto
"""Generated protocol buffer code."""

from google.protobuf import descriptor as _descriptor
from google.protobuf import descriptor_pool as _descriptor_pool
from google.protobuf import message as _message
from google.protobuf import reflection as _reflection
from google.protobuf import symbol_database as _symbol_database
# @@protoc_insertion_point(imports)

_sym_db = _symbol_database.Default()


DESCRIPTOR = _descriptor_pool.Default().AddSerializedFile(
    b'\n-transport/internet/grpc/encoding/stream.proto\x12%xray.transport.internet.grpc.encoding"\x14\n\x04Hunk\x12\x0c\n\x04\x64\x61ta\x18\x01 \x01(\x0c"\x19\n\tMultiHunk\x12\x0c\n\x04\x64\x61ta\x18\x01 \x03(\x0c\x32\xe6\x01\n\x0bGRPCService\x12\x63\n\x03Tun\x12+.xray.transport.internet.grpc.encoding.Hunk\x1a+.xray.transport.internet.grpc.encoding.Hunk(\x01\x30\x01\x12r\n\x08TunMulti\x12\x30.xray.transport.internet.grpc.encoding.MultiHunk\x1a\x30.xray.transport.internet.grpc.encoding.MultiHunk(\x01\x30\x01\x42<Z:github.com/xtls/xray-core/transport/internet/grpc/encodingb\x06proto3'
)


_HUNK = DESCRIPTOR.message_types_by_name["Hunk"]
_MULTIHUNK = DESCRIPTOR.message_types_by_name["MultiHunk"]
Hunk = _reflection.GeneratedProtocolMessageType(
    "Hunk",
    (_message.Message,),
    {
        "DESCRIPTOR": _HUNK,
        "__module__": "transport.internet.grpc.encoding.stream_pb2",
        # @@protoc_insertion_point(class_scope:xray.transport.internet.grpc.encoding.Hunk)
    },
)
_sym_db.RegisterMessage(Hunk)

MultiHunk = _reflection.GeneratedProtocolMessageType(
    "MultiHunk",
    (_message.Message,),
    {
        "DESCRIPTOR": _MULTIHUNK,
        "__module__": "transport.internet.grpc.encoding.stream_pb2",
        # @@protoc_insertion_point(class_scope:xray.transport.internet.grpc.encoding.MultiHunk)
    },
)
_sym_db.RegisterMessage(MultiHunk)

_GRPCSERVICE = DESCRIPTOR.services_by_name["GRPCService"]
if _descriptor._USE_C_DESCRIPTORS == False:
    DESCRIPTOR._options = None
    DESCRIPTOR._serialized_options = b"Z:github.com/xtls/xray-core/transport/internet/grpc/encoding"
    _HUNK._serialized_start = 88
    _HUNK._serialized_end = 108
    _MULTIHUNK._serialized_start = 110
    _MULTIHUNK._serialized_end = 135
    _GRPCSERVICE._serialized_start = 138
    _GRPCSERVICE._serialized_end = 368
# @@protoc_insertion_point(module_scope)

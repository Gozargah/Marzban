# -*- coding: utf-8 -*-
# Generated by the protocol buffer compiler.  DO NOT EDIT!
# source: app/policy/config.proto
"""Generated protocol buffer code."""
from google.protobuf import descriptor as _descriptor
from google.protobuf import descriptor_pool as _descriptor_pool
from google.protobuf import message as _message
from google.protobuf import reflection as _reflection
from google.protobuf import symbol_database as _symbol_database
# @@protoc_insertion_point(imports)

_sym_db = _symbol_database.Default()


DESCRIPTOR = _descriptor_pool.Default().AddSerializedFile(b'\n\x17\x61pp/policy/config.proto\x12\x0fxray.app.policy\"\x17\n\x06Second\x12\r\n\x05value\x18\x01 \x01(\r\"\xb3\x03\n\x06Policy\x12\x30\n\x07timeout\x18\x01 \x01(\x0b\x32\x1f.xray.app.policy.Policy.Timeout\x12,\n\x05stats\x18\x02 \x01(\x0b\x32\x1d.xray.app.policy.Policy.Stats\x12.\n\x06\x62uffer\x18\x03 \x01(\x0b\x32\x1e.xray.app.policy.Policy.Buffer\x1a\xc5\x01\n\x07Timeout\x12*\n\thandshake\x18\x01 \x01(\x0b\x32\x17.xray.app.policy.Second\x12\x30\n\x0f\x63onnection_idle\x18\x02 \x01(\x0b\x32\x17.xray.app.policy.Second\x12,\n\x0buplink_only\x18\x03 \x01(\x0b\x32\x17.xray.app.policy.Second\x12.\n\rdownlink_only\x18\x04 \x01(\x0b\x32\x17.xray.app.policy.Second\x1a\x33\n\x05Stats\x12\x13\n\x0buser_uplink\x18\x01 \x01(\x08\x12\x15\n\ruser_downlink\x18\x02 \x01(\x08\x1a\x1c\n\x06\x42uffer\x12\x12\n\nconnection\x18\x01 \x01(\x05\"\xb1\x01\n\x0cSystemPolicy\x12\x32\n\x05stats\x18\x01 \x01(\x0b\x32#.xray.app.policy.SystemPolicy.Stats\x1am\n\x05Stats\x12\x16\n\x0einbound_uplink\x18\x01 \x01(\x08\x12\x18\n\x10inbound_downlink\x18\x02 \x01(\x08\x12\x17\n\x0foutbound_uplink\x18\x03 \x01(\x08\x12\x19\n\x11outbound_downlink\x18\x04 \x01(\x08\"\xb1\x01\n\x06\x43onfig\x12\x31\n\x05level\x18\x01 \x03(\x0b\x32\".xray.app.policy.Config.LevelEntry\x12-\n\x06system\x18\x02 \x01(\x0b\x32\x1d.xray.app.policy.SystemPolicy\x1a\x45\n\nLevelEntry\x12\x0b\n\x03key\x18\x01 \x01(\r\x12&\n\x05value\x18\x02 \x01(\x0b\x32\x17.xray.app.policy.Policy:\x02\x38\x01\x42O\n\x13\x63om.xray.app.policyP\x01Z$github.com/xtls/xray-core/app/policy\xaa\x02\x0fXray.App.Policyb\x06proto3')


_SECOND = DESCRIPTOR.message_types_by_name['Second']
_POLICY = DESCRIPTOR.message_types_by_name['Policy']
_POLICY_TIMEOUT = _POLICY.nested_types_by_name['Timeout']
_POLICY_STATS = _POLICY.nested_types_by_name['Stats']
_POLICY_BUFFER = _POLICY.nested_types_by_name['Buffer']
_SYSTEMPOLICY = DESCRIPTOR.message_types_by_name['SystemPolicy']
_SYSTEMPOLICY_STATS = _SYSTEMPOLICY.nested_types_by_name['Stats']
_CONFIG = DESCRIPTOR.message_types_by_name['Config']
_CONFIG_LEVELENTRY = _CONFIG.nested_types_by_name['LevelEntry']
Second = _reflection.GeneratedProtocolMessageType('Second', (_message.Message,), {
    'DESCRIPTOR': _SECOND,
    '__module__': 'app.policy.config_pb2'
    # @@protoc_insertion_point(class_scope:xray.app.policy.Second)
})
_sym_db.RegisterMessage(Second)

Policy = _reflection.GeneratedProtocolMessageType('Policy', (_message.Message,), {

    'Timeout': _reflection.GeneratedProtocolMessageType('Timeout', (_message.Message,), {
        'DESCRIPTOR': _POLICY_TIMEOUT,
        '__module__': 'app.policy.config_pb2'
        # @@protoc_insertion_point(class_scope:xray.app.policy.Policy.Timeout)
    }),

    'Stats': _reflection.GeneratedProtocolMessageType('Stats', (_message.Message,), {
        'DESCRIPTOR': _POLICY_STATS,
        '__module__': 'app.policy.config_pb2'
        # @@protoc_insertion_point(class_scope:xray.app.policy.Policy.Stats)
    }),

    'Buffer': _reflection.GeneratedProtocolMessageType('Buffer', (_message.Message,), {
        'DESCRIPTOR': _POLICY_BUFFER,
        '__module__': 'app.policy.config_pb2'
        # @@protoc_insertion_point(class_scope:xray.app.policy.Policy.Buffer)
    }),
    'DESCRIPTOR': _POLICY,
    '__module__': 'app.policy.config_pb2'
    # @@protoc_insertion_point(class_scope:xray.app.policy.Policy)
})
_sym_db.RegisterMessage(Policy)
_sym_db.RegisterMessage(Policy.Timeout)
_sym_db.RegisterMessage(Policy.Stats)
_sym_db.RegisterMessage(Policy.Buffer)

SystemPolicy = _reflection.GeneratedProtocolMessageType('SystemPolicy', (_message.Message,), {

    'Stats': _reflection.GeneratedProtocolMessageType('Stats', (_message.Message,), {
        'DESCRIPTOR': _SYSTEMPOLICY_STATS,
        '__module__': 'app.policy.config_pb2'
        # @@protoc_insertion_point(class_scope:xray.app.policy.SystemPolicy.Stats)
    }),
    'DESCRIPTOR': _SYSTEMPOLICY,
    '__module__': 'app.policy.config_pb2'
    # @@protoc_insertion_point(class_scope:xray.app.policy.SystemPolicy)
})
_sym_db.RegisterMessage(SystemPolicy)
_sym_db.RegisterMessage(SystemPolicy.Stats)

Config = _reflection.GeneratedProtocolMessageType('Config', (_message.Message,), {

    'LevelEntry': _reflection.GeneratedProtocolMessageType('LevelEntry', (_message.Message,), {
        'DESCRIPTOR': _CONFIG_LEVELENTRY,
        '__module__': 'app.policy.config_pb2'
        # @@protoc_insertion_point(class_scope:xray.app.policy.Config.LevelEntry)
    }),
    'DESCRIPTOR': _CONFIG,
    '__module__': 'app.policy.config_pb2'
    # @@protoc_insertion_point(class_scope:xray.app.policy.Config)
})
_sym_db.RegisterMessage(Config)
_sym_db.RegisterMessage(Config.LevelEntry)

if _descriptor._USE_C_DESCRIPTORS == False:

    DESCRIPTOR._options = None
    DESCRIPTOR._serialized_options = b'\n\023com.xray.app.policyP\001Z$github.com/xtls/xray-core/app/policy\252\002\017Xray.App.Policy'
    _CONFIG_LEVELENTRY._options = None
    _CONFIG_LEVELENTRY._serialized_options = b'8\001'
    _SECOND._serialized_start = 44
    _SECOND._serialized_end = 67
    _POLICY._serialized_start = 70
    _POLICY._serialized_end = 505
    _POLICY_TIMEOUT._serialized_start = 225
    _POLICY_TIMEOUT._serialized_end = 422
    _POLICY_STATS._serialized_start = 424
    _POLICY_STATS._serialized_end = 475
    _POLICY_BUFFER._serialized_start = 477
    _POLICY_BUFFER._serialized_end = 505
    _SYSTEMPOLICY._serialized_start = 508
    _SYSTEMPOLICY._serialized_end = 685
    _SYSTEMPOLICY_STATS._serialized_start = 576
    _SYSTEMPOLICY_STATS._serialized_end = 685
    _CONFIG._serialized_start = 688
    _CONFIG._serialized_end = 865
    _CONFIG_LEVELENTRY._serialized_start = 796
    _CONFIG_LEVELENTRY._serialized_end = 865
# @@protoc_insertion_point(module_scope)

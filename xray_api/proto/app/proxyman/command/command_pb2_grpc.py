# Generated by the gRPC Python protocol compiler plugin. DO NOT EDIT!
"""Client and server classes corresponding to protobuf-defined services."""

import grpc

from xray_api.proto.app.proxyman.command import (
    command_pb2 as app_dot_proxyman_dot_command_dot_command__pb2,
)


class HandlerServiceStub(object):
    """Missing associated documentation comment in .proto file."""

    def __init__(self, channel):
        """Constructor.

        Args:
            channel: A grpc.Channel.
        """
        self.AddInbound = channel.unary_unary(
            "/xray.app.proxyman.command.HandlerService/AddInbound",
            request_serializer=app_dot_proxyman_dot_command_dot_command__pb2.AddInboundRequest.SerializeToString,
            response_deserializer=app_dot_proxyman_dot_command_dot_command__pb2.AddInboundResponse.FromString,
        )
        self.RemoveInbound = channel.unary_unary(
            "/xray.app.proxyman.command.HandlerService/RemoveInbound",
            request_serializer=app_dot_proxyman_dot_command_dot_command__pb2.RemoveInboundRequest.SerializeToString,
            response_deserializer=app_dot_proxyman_dot_command_dot_command__pb2.RemoveInboundResponse.FromString,
        )
        self.AlterInbound = channel.unary_unary(
            "/xray.app.proxyman.command.HandlerService/AlterInbound",
            request_serializer=app_dot_proxyman_dot_command_dot_command__pb2.AlterInboundRequest.SerializeToString,
            response_deserializer=app_dot_proxyman_dot_command_dot_command__pb2.AlterInboundResponse.FromString,
        )
        self.AddOutbound = channel.unary_unary(
            "/xray.app.proxyman.command.HandlerService/AddOutbound",
            request_serializer=app_dot_proxyman_dot_command_dot_command__pb2.AddOutboundRequest.SerializeToString,
            response_deserializer=app_dot_proxyman_dot_command_dot_command__pb2.AddOutboundResponse.FromString,
        )
        self.RemoveOutbound = channel.unary_unary(
            "/xray.app.proxyman.command.HandlerService/RemoveOutbound",
            request_serializer=app_dot_proxyman_dot_command_dot_command__pb2.RemoveOutboundRequest.SerializeToString,
            response_deserializer=app_dot_proxyman_dot_command_dot_command__pb2.RemoveOutboundResponse.FromString,
        )
        self.AlterOutbound = channel.unary_unary(
            "/xray.app.proxyman.command.HandlerService/AlterOutbound",
            request_serializer=app_dot_proxyman_dot_command_dot_command__pb2.AlterOutboundRequest.SerializeToString,
            response_deserializer=app_dot_proxyman_dot_command_dot_command__pb2.AlterOutboundResponse.FromString,
        )


class HandlerServiceServicer(object):
    """Missing associated documentation comment in .proto file."""

    def AddInbound(self, request, context):
        """Missing associated documentation comment in .proto file."""
        context.set_code(grpc.StatusCode.UNIMPLEMENTED)
        context.set_details("Method not implemented!")
        raise NotImplementedError("Method not implemented!")

    def RemoveInbound(self, request, context):
        """Missing associated documentation comment in .proto file."""
        context.set_code(grpc.StatusCode.UNIMPLEMENTED)
        context.set_details("Method not implemented!")
        raise NotImplementedError("Method not implemented!")

    def AlterInbound(self, request, context):
        """Missing associated documentation comment in .proto file."""
        context.set_code(grpc.StatusCode.UNIMPLEMENTED)
        context.set_details("Method not implemented!")
        raise NotImplementedError("Method not implemented!")

    def AddOutbound(self, request, context):
        """Missing associated documentation comment in .proto file."""
        context.set_code(grpc.StatusCode.UNIMPLEMENTED)
        context.set_details("Method not implemented!")
        raise NotImplementedError("Method not implemented!")

    def RemoveOutbound(self, request, context):
        """Missing associated documentation comment in .proto file."""
        context.set_code(grpc.StatusCode.UNIMPLEMENTED)
        context.set_details("Method not implemented!")
        raise NotImplementedError("Method not implemented!")

    def AlterOutbound(self, request, context):
        """Missing associated documentation comment in .proto file."""
        context.set_code(grpc.StatusCode.UNIMPLEMENTED)
        context.set_details("Method not implemented!")
        raise NotImplementedError("Method not implemented!")


def add_HandlerServiceServicer_to_server(servicer, server):
    rpc_method_handlers = {
        "AddInbound": grpc.unary_unary_rpc_method_handler(
            servicer.AddInbound,
            request_deserializer=app_dot_proxyman_dot_command_dot_command__pb2.AddInboundRequest.FromString,
            response_serializer=app_dot_proxyman_dot_command_dot_command__pb2.AddInboundResponse.SerializeToString,
        ),
        "RemoveInbound": grpc.unary_unary_rpc_method_handler(
            servicer.RemoveInbound,
            request_deserializer=app_dot_proxyman_dot_command_dot_command__pb2.RemoveInboundRequest.FromString,
            response_serializer=app_dot_proxyman_dot_command_dot_command__pb2.RemoveInboundResponse.SerializeToString,
        ),
        "AlterInbound": grpc.unary_unary_rpc_method_handler(
            servicer.AlterInbound,
            request_deserializer=app_dot_proxyman_dot_command_dot_command__pb2.AlterInboundRequest.FromString,
            response_serializer=app_dot_proxyman_dot_command_dot_command__pb2.AlterInboundResponse.SerializeToString,
        ),
        "AddOutbound": grpc.unary_unary_rpc_method_handler(
            servicer.AddOutbound,
            request_deserializer=app_dot_proxyman_dot_command_dot_command__pb2.AddOutboundRequest.FromString,
            response_serializer=app_dot_proxyman_dot_command_dot_command__pb2.AddOutboundResponse.SerializeToString,
        ),
        "RemoveOutbound": grpc.unary_unary_rpc_method_handler(
            servicer.RemoveOutbound,
            request_deserializer=app_dot_proxyman_dot_command_dot_command__pb2.RemoveOutboundRequest.FromString,
            response_serializer=app_dot_proxyman_dot_command_dot_command__pb2.RemoveOutboundResponse.SerializeToString,
        ),
        "AlterOutbound": grpc.unary_unary_rpc_method_handler(
            servicer.AlterOutbound,
            request_deserializer=app_dot_proxyman_dot_command_dot_command__pb2.AlterOutboundRequest.FromString,
            response_serializer=app_dot_proxyman_dot_command_dot_command__pb2.AlterOutboundResponse.SerializeToString,
        ),
    }
    generic_handler = grpc.method_handlers_generic_handler(
        "xray.app.proxyman.command.HandlerService", rpc_method_handlers
    )
    server.add_generic_rpc_handlers((generic_handler,))


# This class is part of an EXPERIMENTAL API.
class HandlerService(object):
    """Missing associated documentation comment in .proto file."""

    @staticmethod
    def AddInbound(
        request,
        target,
        options=(),
        channel_credentials=None,
        call_credentials=None,
        insecure=False,
        compression=None,
        wait_for_ready=None,
        timeout=None,
        metadata=None,
    ):
        return grpc.experimental.unary_unary(
            request,
            target,
            "/xray.app.proxyman.command.HandlerService/AddInbound",
            app_dot_proxyman_dot_command_dot_command__pb2.AddInboundRequest.SerializeToString,
            app_dot_proxyman_dot_command_dot_command__pb2.AddInboundResponse.FromString,
            options,
            channel_credentials,
            insecure,
            call_credentials,
            compression,
            wait_for_ready,
            timeout,
            metadata,
        )

    @staticmethod
    def RemoveInbound(
        request,
        target,
        options=(),
        channel_credentials=None,
        call_credentials=None,
        insecure=False,
        compression=None,
        wait_for_ready=None,
        timeout=None,
        metadata=None,
    ):
        return grpc.experimental.unary_unary(
            request,
            target,
            "/xray.app.proxyman.command.HandlerService/RemoveInbound",
            app_dot_proxyman_dot_command_dot_command__pb2.RemoveInboundRequest.SerializeToString,
            app_dot_proxyman_dot_command_dot_command__pb2.RemoveInboundResponse.FromString,
            options,
            channel_credentials,
            insecure,
            call_credentials,
            compression,
            wait_for_ready,
            timeout,
            metadata,
        )

    @staticmethod
    def AlterInbound(
        request,
        target,
        options=(),
        channel_credentials=None,
        call_credentials=None,
        insecure=False,
        compression=None,
        wait_for_ready=None,
        timeout=None,
        metadata=None,
    ):
        return grpc.experimental.unary_unary(
            request,
            target,
            "/xray.app.proxyman.command.HandlerService/AlterInbound",
            app_dot_proxyman_dot_command_dot_command__pb2.AlterInboundRequest.SerializeToString,
            app_dot_proxyman_dot_command_dot_command__pb2.AlterInboundResponse.FromString,
            options,
            channel_credentials,
            insecure,
            call_credentials,
            compression,
            wait_for_ready,
            timeout,
            metadata,
        )

    @staticmethod
    def AddOutbound(
        request,
        target,
        options=(),
        channel_credentials=None,
        call_credentials=None,
        insecure=False,
        compression=None,
        wait_for_ready=None,
        timeout=None,
        metadata=None,
    ):
        return grpc.experimental.unary_unary(
            request,
            target,
            "/xray.app.proxyman.command.HandlerService/AddOutbound",
            app_dot_proxyman_dot_command_dot_command__pb2.AddOutboundRequest.SerializeToString,
            app_dot_proxyman_dot_command_dot_command__pb2.AddOutboundResponse.FromString,
            options,
            channel_credentials,
            insecure,
            call_credentials,
            compression,
            wait_for_ready,
            timeout,
            metadata,
        )

    @staticmethod
    def RemoveOutbound(
        request,
        target,
        options=(),
        channel_credentials=None,
        call_credentials=None,
        insecure=False,
        compression=None,
        wait_for_ready=None,
        timeout=None,
        metadata=None,
    ):
        return grpc.experimental.unary_unary(
            request,
            target,
            "/xray.app.proxyman.command.HandlerService/RemoveOutbound",
            app_dot_proxyman_dot_command_dot_command__pb2.RemoveOutboundRequest.SerializeToString,
            app_dot_proxyman_dot_command_dot_command__pb2.RemoveOutboundResponse.FromString,
            options,
            channel_credentials,
            insecure,
            call_credentials,
            compression,
            wait_for_ready,
            timeout,
            metadata,
        )

    @staticmethod
    def AlterOutbound(
        request,
        target,
        options=(),
        channel_credentials=None,
        call_credentials=None,
        insecure=False,
        compression=None,
        wait_for_ready=None,
        timeout=None,
        metadata=None,
    ):
        return grpc.experimental.unary_unary(
            request,
            target,
            "/xray.app.proxyman.command.HandlerService/AlterOutbound",
            app_dot_proxyman_dot_command_dot_command__pb2.AlterOutboundRequest.SerializeToString,
            app_dot_proxyman_dot_command_dot_command__pb2.AlterOutboundResponse.FromString,
            options,
            channel_credentials,
            insecure,
            call_credentials,
            compression,
            wait_for_ready,
            timeout,
            metadata,
        )

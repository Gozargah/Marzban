# Generated by the gRPC Python protocol compiler plugin. DO NOT EDIT!
"""Client and server classes corresponding to protobuf-defined services."""

import grpc

from xray_api.proto.app.stats.command import (
    command_pb2 as app_dot_stats_dot_command_dot_command__pb2,
)


class StatsServiceStub(object):
    """Missing associated documentation comment in .proto file."""

    def __init__(self, channel):
        """Constructor.

        Args:
            channel: A grpc.Channel.
        """
        self.GetStats = channel.unary_unary(
            "/xray.app.stats.command.StatsService/GetStats",
            request_serializer=app_dot_stats_dot_command_dot_command__pb2.GetStatsRequest.SerializeToString,
            response_deserializer=app_dot_stats_dot_command_dot_command__pb2.GetStatsResponse.FromString,
        )
        self.QueryStats = channel.unary_unary(
            "/xray.app.stats.command.StatsService/QueryStats",
            request_serializer=app_dot_stats_dot_command_dot_command__pb2.QueryStatsRequest.SerializeToString,
            response_deserializer=app_dot_stats_dot_command_dot_command__pb2.QueryStatsResponse.FromString,
        )
        self.GetSysStats = channel.unary_unary(
            "/xray.app.stats.command.StatsService/GetSysStats",
            request_serializer=app_dot_stats_dot_command_dot_command__pb2.SysStatsRequest.SerializeToString,
            response_deserializer=app_dot_stats_dot_command_dot_command__pb2.SysStatsResponse.FromString,
        )


class StatsServiceServicer(object):
    """Missing associated documentation comment in .proto file."""

    def GetStats(self, request, context):
        """Missing associated documentation comment in .proto file."""
        context.set_code(grpc.StatusCode.UNIMPLEMENTED)
        context.set_details("Method not implemented!")
        raise NotImplementedError("Method not implemented!")

    def QueryStats(self, request, context):
        """Missing associated documentation comment in .proto file."""
        context.set_code(grpc.StatusCode.UNIMPLEMENTED)
        context.set_details("Method not implemented!")
        raise NotImplementedError("Method not implemented!")

    def GetSysStats(self, request, context):
        """Missing associated documentation comment in .proto file."""
        context.set_code(grpc.StatusCode.UNIMPLEMENTED)
        context.set_details("Method not implemented!")
        raise NotImplementedError("Method not implemented!")


def add_StatsServiceServicer_to_server(servicer, server):
    rpc_method_handlers = {
        "GetStats": grpc.unary_unary_rpc_method_handler(
            servicer.GetStats,
            request_deserializer=app_dot_stats_dot_command_dot_command__pb2.GetStatsRequest.FromString,
            response_serializer=app_dot_stats_dot_command_dot_command__pb2.GetStatsResponse.SerializeToString,
        ),
        "QueryStats": grpc.unary_unary_rpc_method_handler(
            servicer.QueryStats,
            request_deserializer=app_dot_stats_dot_command_dot_command__pb2.QueryStatsRequest.FromString,
            response_serializer=app_dot_stats_dot_command_dot_command__pb2.QueryStatsResponse.SerializeToString,
        ),
        "GetSysStats": grpc.unary_unary_rpc_method_handler(
            servicer.GetSysStats,
            request_deserializer=app_dot_stats_dot_command_dot_command__pb2.SysStatsRequest.FromString,
            response_serializer=app_dot_stats_dot_command_dot_command__pb2.SysStatsResponse.SerializeToString,
        ),
    }
    generic_handler = grpc.method_handlers_generic_handler(
        "xray.app.stats.command.StatsService", rpc_method_handlers
    )
    server.add_generic_rpc_handlers((generic_handler,))


# This class is part of an EXPERIMENTAL API.
class StatsService(object):
    """Missing associated documentation comment in .proto file."""

    @staticmethod
    def GetStats(
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
            "/xray.app.stats.command.StatsService/GetStats",
            app_dot_stats_dot_command_dot_command__pb2.GetStatsRequest.SerializeToString,
            app_dot_stats_dot_command_dot_command__pb2.GetStatsResponse.FromString,
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
    def QueryStats(
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
            "/xray.app.stats.command.StatsService/QueryStats",
            app_dot_stats_dot_command_dot_command__pb2.QueryStatsRequest.SerializeToString,
            app_dot_stats_dot_command_dot_command__pb2.QueryStatsResponse.FromString,
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
    def GetSysStats(
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
            "/xray.app.stats.command.StatsService/GetSysStats",
            app_dot_stats_dot_command_dot_command__pb2.SysStatsRequest.SerializeToString,
            app_dot_stats_dot_command_dot_command__pb2.SysStatsResponse.FromString,
            options,
            channel_credentials,
            insecure,
            call_credentials,
            compression,
            wait_for_ready,
            timeout,
            metadata,
        )

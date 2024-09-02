import typing
from dataclasses import dataclass

import grpc

from .base import XRayBase
from .exceptions import RelatedError
from .proto.app.stats.command import command_pb2, command_pb2_grpc


@dataclass
class SysStatsResponse:
    num_goroutine: int
    num_gc: int
    alloc: int
    total_alloc: int
    sys: int
    mallocs: int
    frees: int
    live_objects: int
    pause_total_ns: int
    uptime: int


@dataclass
class StatResponse:
    name: str
    type: str
    link: str
    value: int


@dataclass
class UserStatsResponse:
    email: str
    uplink: int
    downlink: int


@dataclass
class InboundStatsResponse:
    tag: str
    uplink: int
    downlink: int


@dataclass
class OutboundStatsResponse:
    tag: str
    uplink: int
    downlink: int


class Stats(XRayBase):
    def get_sys_stats(self, timeout: int = None) -> SysStatsResponse:
        try:
            stub = command_pb2_grpc.StatsServiceStub(self._channel)
            r = stub.GetSysStats(command_pb2.SysStatsRequest(), timeout=timeout)

        except grpc.RpcError as e:
            raise RelatedError(e)

        return SysStatsResponse(
            num_goroutine=r.NumGoroutine,
            num_gc=r.NumGC,
            alloc=r.Alloc,
            total_alloc=r.TotalAlloc,
            sys=r.Sys,
            mallocs=r.Mallocs,
            frees=r.Frees,
            live_objects=r.LiveObjects,
            pause_total_ns=r.PauseTotalNs,
            uptime=r.Uptime
        )

    def query_stats(self, pattern: str, reset: bool = False, timeout: int = None) -> typing.Iterable[StatResponse]:
        try:
            stub = command_pb2_grpc.StatsServiceStub(self._channel)
            r = stub.QueryStats(command_pb2.QueryStatsRequest(pattern=pattern, reset=reset), timeout=timeout)

        except grpc.RpcError as e:
            raise RelatedError(e)

        for stat in r.stat:
            type, name, _, link = stat.name.split('>>>')
            yield StatResponse(name, type, link, stat.value)

    def get_users_stats(self, reset: bool = False, timeout: int = None) -> typing.Iterable[StatResponse]:
        return self.query_stats("user>>>", reset=reset, timeout=timeout)

    def get_inbounds_stats(self, reset: bool = False, timeout: int = None) -> typing.Iterable[StatResponse]:
        return self.query_stats("inbound>>>", reset=reset, timeout=timeout)

    def get_outbounds_stats(self, reset: bool = False, timeout: int = None) -> typing.Iterable[StatResponse]:
        return self.query_stats("outbound>>>", reset=reset, timeout=timeout)

    def get_user_stats(self, email: str, reset: bool = False, timeout: int = None) -> typing.Iterable[StatResponse]:
        uplink, downlink = 0, 0
        for stat in self.query_stats(f"user>>>{email}>>>", reset=reset, timeout=timeout):
            if stat.link == 'uplink':
                uplink = stat.value
            if stat.link == 'downlink':
                downlink = stat.value

        return UserStatsResponse(email=email, uplink=uplink, downlink=downlink)

    def get_inbound_stats(self, tag: str, reset: bool = False, timeout: int = None) -> typing.Iterable[StatResponse]:
        uplink, downlink = 0, 0
        for stat in self.query_stats(f"inbound>>>{tag}>>>", reset=reset, timeout=timeout):
            if stat.link == 'uplink':
                uplink = stat.value
            if stat.link == 'downlink':
                downlink = stat.value
        return InboundStatsResponse(tag=tag, uplink=uplink, downlink=downlink)

    def get_outbound_stats(self, tag: str, reset: bool = False, timeout: int = None) -> typing.Iterable[StatResponse]:
        uplink, downlink = 0, 0
        for stat in self.query_stats(f"outbound>>>{tag}>>>", reset=reset, timeout=timeout):
            if stat.link == 'uplink':
                uplink = stat.value
            if stat.link == 'downlink':
                downlink = stat.value
        return OutboundStatsResponse(tag=tag, uplink=uplink, downlink=downlink)

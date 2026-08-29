import ipaddress
import math
import secrets
import socket
import time
from dataclasses import dataclass

import psutil
import requests

from app import scheduler


@dataclass
class MemoryStat():
    total: int
    used: int
    free: int


@dataclass
class CPUStat():
    cores: int
    percent: float


def cpu_usage() -> CPUStat:
    return CPUStat(cores=psutil.cpu_count(), percent=psutil.cpu_percent())


def memory_usage() -> MemoryStat:
    mem = psutil.virtual_memory()
    return MemoryStat(total=mem.total, used=mem.used, free=mem.available)


@dataclass
class RealtimeBandwidth:
    def __post_init__(self):
        io = psutil.net_io_counters()
        self.bytes_recv = io.bytes_recv
        self.bytes_sent = io.bytes_sent
        self.packets_recv = io.packets_recv
        self.packets_sent = io.packets_sent
        self.last_perf_counter = time.perf_counter()

    # data in the form of value per seconds
    incoming_bytes: int
    outgoing_bytes: int
    incoming_packets: int
    outgoing_packets: int

    bytes_recv: int = None
    bytes_sent: int = None
    packets_recv: int = None
    packets_sent: int = None
    last_perf_counter: float = None


@dataclass
class RealtimeBandwidthStat:
    """Real-Time bandwith in value/s unit"""

    incoming_bytes: int
    outgoing_bytes: int
    incoming_packets: int
    outgoing_packets: int


rt_bw = RealtimeBandwidth(
    incoming_bytes=0, outgoing_bytes=0, incoming_packets=0, outgoing_packets=0)


# sample time is 2 seconds, values lower than this may not produce good results
@scheduler.scheduled_job("interval", seconds=2, coalesce=True, max_instances=1)
def record_realtime_bandwidth() -> None:
    global rt_bw
    last_perf_counter = rt_bw.last_perf_counter
    io = psutil.net_io_counters()
    rt_bw.last_perf_counter = time.perf_counter()
    sample_time = rt_bw.last_perf_counter - last_perf_counter
    rt_bw.incoming_bytes, rt_bw.bytes_recv = round((io.bytes_recv - rt_bw.bytes_recv) / sample_time), io.bytes_recv
    rt_bw.outgoing_bytes, rt_bw.bytes_sent = round((io.bytes_sent - rt_bw.bytes_sent) / sample_time), io.bytes_sent
    rt_bw.incoming_packets, rt_bw.packets_recv = round((io.packets_recv - rt_bw.packets_recv) / sample_time), io.packets_recv
    rt_bw.outgoing_packets, rt_bw.packets_sent = round((io.packets_sent - rt_bw.packets_sent) / sample_time), io.packets_sent


def realtime_bandwidth() -> RealtimeBandwidthStat:
    return RealtimeBandwidthStat(
        incoming_bytes=rt_bw.incoming_bytes,
        outgoing_bytes=rt_bw.outgoing_bytes,
        incoming_packets=rt_bw.incoming_packets,
        outgoing_packets=rt_bw.outgoing_packets,
    )


def random_password() -> str:
    return secrets.token_urlsafe(16)


def check_port(port: int) -> bool:
    s = socket.socket()
    try:
        s.connect(('127.0.0.1', port))
        return True
    except socket.error:
        return False
    finally:
        s.close()


# What one of these lookups is allowed to fail with: the request itself, or a
# body that turns out not to be the address it was supposed to be
# (AddressValueError is a ValueError). Caught by name rather than with a bare
# `except`, which would also swallow a Ctrl-C.
LOOKUP_ERRORS = (requests.RequestException, ValueError)


def get_public_ip():
    try:
        resp = requests.get('http://api4.ipify.org/', timeout=5).text.strip()
        if ipaddress.IPv4Address(resp).is_global:
            return resp
    except LOOKUP_ERRORS:
        pass

    try:
        resp = requests.get('http://ipv4.icanhazip.com/', timeout=5).text.strip()
        if ipaddress.IPv4Address(resp).is_global:
            return resp
    except LOOKUP_ERRORS:
        pass

    try:
        requests.packages.urllib3.util.connection.HAS_IPV6 = False
        resp = requests.get('https://ifconfig.io/ip', timeout=5).text.strip()
        if ipaddress.IPv4Address(resp).is_global:
            return resp
    except LOOKUP_ERRORS:
        pass
    finally:
        requests.packages.urllib3.util.connection.HAS_IPV6 = True

    # No packet is sent by connecting a UDP socket; it only asks the routing
    # table which address would be used to reach the internet. The socket is
    # opened inside the try and closed by the `with`: out of descriptors, the
    # old `finally: sock.close()` raised NameError over the real error.
    try:
        with socket.socket(socket.AF_INET, socket.SOCK_DGRAM) as sock:
            sock.connect(('8.8.8.8', 80))
            resp = sock.getsockname()[0]
        if ipaddress.IPv4Address(resp).is_global:
            return resp
    except (OSError, IndexError, ValueError):
        pass

    return '127.0.0.1'


def get_public_ipv6():
    try:
        resp = requests.get('http://api6.ipify.org/', timeout=5).text.strip()
        if ipaddress.IPv6Address(resp).is_global:
            return '[%s]' % resp
    except LOOKUP_ERRORS:
        pass

    try:
        resp = requests.get('http://ipv6.icanhazip.com/', timeout=5).text.strip()
        if ipaddress.IPv6Address(resp).is_global:
            return '[%s]' % resp
    except LOOKUP_ERRORS:
        pass

    return '[::1]'


def readable_size(size_bytes):
    if size_bytes <= 0:
        return "0 B"
    size_name = ("B", "KB", "MB", "GB", "TB", "PB", "EB", "ZB", "YB")
    i = int(math.floor(math.log(size_bytes, 1024)))
    p = math.pow(1024, i)
    s = round(size_bytes / p, 2)
    return f'{s} {size_name[i]}'


@dataclass
class InterfaceStat:
    name: str
    mac: str = None
    mtu: int = None
    addresses: list = None


def network_interfaces() -> list:
    """Interfaces the host has, loopback aside.

    Reported so the System settings screen can show what it is tuning; the
    panel never reconfigures an interface, since the request that did it would
    arrive over the one being changed.
    """
    stats = psutil.net_if_stats()
    interfaces = []

    for name, addresses in psutil.net_if_addrs().items():
        if name == "lo":
            continue

        mac = next((a.address for a in addresses if a.family == psutil.AF_LINK), None)
        ips = [
            a.address for a in addresses
            if a.family in (socket.AF_INET, socket.AF_INET6) and a.address
        ]
        stat = stats.get(name)
        interfaces.append(
            InterfaceStat(name=name, mac=mac, mtu=stat.mtu if stat else None, addresses=ips)
        )

    return sorted(interfaces, key=lambda interface: interface.name)

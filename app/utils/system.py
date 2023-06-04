import requests
import math
import secrets
import socket
from dataclasses import dataclass

import psutil

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
        self.packet_sent = io.packets_sent

    incoming_bytes: int
    outgoing_bytes: int
    incoming_packets: int
    outgoing_packets: int

    bytes_recv: int = None
    bytes_sent: int = None
    packets_recv: int = None
    packet_sent: int = None


@dataclass
class RealtimeBandwidthStat:
    incoming_bytes: int
    outgoing_bytes: int
    incoming_packets: int
    outgoing_packets: int


rt_bw = RealtimeBandwidth(
    incoming_bytes=0, outgoing_bytes=0, incoming_packets=0, outgoing_packets=0)


@scheduler.scheduled_job('interval', seconds=1)
def record_realtime_bandwidth() -> None:
    io = psutil.net_io_counters()
    rt_bw.incoming_bytes, rt_bw.bytes_recv = io.bytes_recv - rt_bw.bytes_recv, io.bytes_recv
    rt_bw.outgoing_bytes, rt_bw.bytes_sent = io.bytes_sent - rt_bw.bytes_sent, io.bytes_sent
    rt_bw.incoming_packets, rt_bw.packets_recv = io.packets_recv - rt_bw.packets_recv, io.packets_recv
    rt_bw.outgoing_packets, rt_bw.packet_sent = io.packets_sent - rt_bw.packet_sent, io.packets_sent


def realtime_bandwith() -> RealtimeBandwidthStat:
    return RealtimeBandwidthStat(
        incoming_bytes=rt_bw.incoming_bytes, outgoing_bytes=rt_bw.outgoing_bytes,
        incoming_packets=rt_bw.incoming_packets, outgoing_packets=rt_bw.outgoing_packets)


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


def get_public_ip():
    try:
        return requests.get('https://api.ipify.org?format=json&ipv=4', timeout=5).json()['ip']
    except (requests.exceptions.RequestException,
            requests.exceptions.RequestException,
            KeyError) as e:
        pass

    try:
        requests.packages.urllib3.util.connection.HAS_IPV6 = False
        return requests.get('https://ifconfig.io/ip', timeout=5).text.strip()
    except (requests.exceptions.RequestException,
            requests.exceptions.RequestException,
            KeyError) as e:
        pass
    finally:
        requests.packages.urllib3.util.connection.HAS_IPV6 = True

    try:
        sock = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        sock.connect(('8.8.8.8', 80))
        return sock.getsockname()[0]
    except (socket.error, IndexError):
        pass
    finally:
        socket.close()

    return '127.0.0.1'


def get_public_ip():
    try:
        s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        s.connect(("8.8.8.8", 80))
        return s.getsockname()[0]
    except socket.error:
        return '127.0.0.1'
    finally:
        s.close()


def readable_size(size_bytes):
    if size_bytes == 0:
        return "0 B"
    size_name = ("B", "KB", "MB", "GB", "TB", "PB", "EB", "ZB", "YB")
    i = int(math.floor(math.log(size_bytes, 1024)))
    p = math.pow(1024, i)
    s = round(size_bytes / p, 2)
    return f'{s} {size_name[i]}'

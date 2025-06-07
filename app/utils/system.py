import ipaddress
import math
import secrets
import socket
from dataclasses import dataclass

import httpx
import psutil


@dataclass
class MemoryStat:
    total: int
    used: int
    free: int


@dataclass
class CPUStat:
    cores: int
    percent: float


def cpu_usage() -> CPUStat:
    return CPUStat(cores=psutil.cpu_count(), percent=psutil.cpu_percent())


def memory_usage() -> MemoryStat:
    mem = psutil.virtual_memory()
    return MemoryStat(total=mem.total, used=mem.used, free=mem.available)


def random_password() -> str:
    return secrets.token_urlsafe(24)


def check_port(port: int) -> bool:
    s = socket.socket()
    try:
        s.connect(("127.0.0.1", port))
        return True
    except socket.error:
        return False
    finally:
        s.close()


def get_public_ip():
    try:
        resp = httpx.get("http://api4.ipify.org/", timeout=5).text.strip()
        if ipaddress.IPv4Address(resp).is_global:
            return resp
    except Exception:
        pass

    try:
        resp = httpx.get("http://ipv4.icanhazip.com/", timeout=5).text.strip()
        if ipaddress.IPv4Address(resp).is_global:
            return resp
    except Exception:
        pass

    # Disable IPv6 for this request
    transport = httpx.HTTPTransport(local_address="0.0.0.0")
    with httpx.Client(transport=transport) as client:
        try:
            resp = client.get("https://ifconfig.io/ip", timeout=5).text.strip()
            if ipaddress.IPv4Address(resp).is_global:
                return resp
        except httpx.RequestError:
            pass

    try:
        sock = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        sock.connect(("8.8.8.8", 80))
        resp = sock.getsockname()[0]
        if ipaddress.IPv4Address(resp).is_global:
            return resp
    except (socket.error, IndexError):
        pass
    finally:
        sock.close()

    return "127.0.0.1"


def get_public_ipv6():
    try:
        resp = httpx.get("http://api6.ipify.org/", timeout=5).text.strip()
        if ipaddress.IPv6Address(resp).is_global:
            return "[%s]" % resp
    except Exception:
        pass

    try:
        resp = httpx.get("http://ipv6.icanhazip.com/", timeout=5).text.strip()
        if ipaddress.IPv6Address(resp).is_global:
            return "[%s]" % resp
    except Exception:
        pass

    return "[::1]"


def readable_size(size_bytes):
    if not size_bytes or size_bytes <= 0:
        return "0 B"
    size_name = ("B", "KB", "MB", "GB", "TB", "PB", "EB", "ZB", "YB")
    i = int(math.floor(math.log(size_bytes, 1024)))
    p = math.pow(1024, i)
    s = round(size_bytes / p, 2)
    return f"{s} {size_name[i]}"

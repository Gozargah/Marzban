import secrets
import socket
from dataclasses import dataclass

import psutil


@dataclass
class MemoryStat():
    total: int
    used: int
    free: int


@dataclass
class CPUStat():
    cores: int
    percent: int


def cpu_usage() -> CPUStat:
    return CPUStat(cores=psutil.cpu_count(), percent=psutil.cpu_percent())


def memory_usage() -> MemoryStat:
    mem = psutil.virtual_memory()
    return MemoryStat(total=mem.total, used=mem.used, free=mem.available)


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

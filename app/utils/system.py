import os
import secrets
import socket
from dataclasses import dataclass


@dataclass
class MemoryStat():
    total: int
    used: int
    free: int


def memory_usage() -> MemoryStat:
    total, used, free = map(int, os.popen('free -t -b').readlines()[-1].split()[1:])
    return MemoryStat(total=total, used=used, free=free)


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

import base64
import json
import os
import secrets
import socket
import urllib.parse as urlparse
from dataclasses import dataclass
from uuid import UUID

from config import XRAY_HOSTS


@dataclass
class MemoryStat():
    total: int
    used: int
    free: int


def mem_usage() -> MemoryStat:
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


def vmess_link(remark: str,
               address: str,
               id: str | UUID,
               host='',
               net='tcp',
               path='',
               sni='',
               tls=False,
               type=''):
    return "vmess://" + base64.b64encode(json.dumps({
        'add': address,
        'aid': '0',
        'host': host,
        'id': str(id),
        'net': net,
        'path': urlparse.quote(path),
        'port': INBOUND_PORTS['vmess'],
        'ps': remark,
        'scy': 'auto',
        'sni': sni,
        'tls': 'tls' if tls else '',
        'type': type,
        'v': '2'
    }, sort_keys=True).encode('utf-8')).decode()


def vless_link(remark: str,
               address: str,
               id: str | UUID,
               net='ws',
               path='',
               tls=False,
               host='',
               sni=''):
    return "vless://" + \
        f"{id}@{address}:{INBOUND_PORTS['vless']}?" + \
        urlparse.urlencode({
           "security": "tls" if tls else "none",
            "type": net,
            "path": urlparse.quote(path),
            "host": host,
            "encryption": "none",
            "sni": sni
        }) + f"#{( urlparse.quote(remark))}"


def trojan_link(remark: str,
                address: str,
                password: str,
                net='tcp',
                path='',
                tls=False,
                host='',
                sni=''):
    return "trojan://" + \
        f"{urlparse.quote(password, safe=':')}@{address}:{INBOUND_PORTS['trojan']}?" + \
        urlparse.urlencode({
            "security": "tls" if tls else "none",
            "type": net,
            "path": urlparse.quote(path),
            "host": host,
            "sni": sni
        }) + f"#{urlparse.quote(remark)}"


def shadowsocks_link(remark: str,
                     address: str,
                     password: str,
                     security='chacha20-ietf-poly1305'):
    return "ss://" + \
        base64.b64encode(f'{security}:{password}'.encode()).decode() + \
        f"@{address}:{INBOUND_PORTS['shadowsocks']}#{urlparse.quote(remark)}"


def get_share_link(remark: str, host: str, protocol: str, settings: dict):
    if protocol == 'vmess':
        return vmess_link(remark=remark,
                          address=host,
                          id=settings['id'],
                          net=INBOUND_STREAMS[protocol]['net'],
                          tls=INBOUND_STREAMS[protocol]['tls'],
                          sni=INBOUND_STREAMS[protocol]['sni'],
                          host=INBOUND_STREAMS[protocol]['sni'],
                          path=INBOUND_STREAMS[protocol]['path'])

    if protocol == 'vless':
        return vless_link(remark=remark,
                          address=host,
                          id=settings['id'],
                          net=INBOUND_STREAMS[protocol]['net'],
                          tls=INBOUND_STREAMS[protocol]['tls'],
                          sni=INBOUND_STREAMS[protocol]['sni'],
                          host=INBOUND_STREAMS[protocol]['sni'],
                          path=INBOUND_STREAMS[protocol]['path'])

    if protocol == 'trojan':
        return trojan_link(remark=remark,
                           address=host,
                           password=settings['password'],
                           net=INBOUND_STREAMS[protocol]['net'],
                           tls=INBOUND_STREAMS[protocol]['tls'],
                           sni=INBOUND_STREAMS[protocol]['sni'],
                           host=INBOUND_STREAMS[protocol]['sni'],
                           path=INBOUND_STREAMS[protocol]['path'])

    if protocol == 'shadowsocks':
        return shadowsocks_link(remark=remark,
                                address=host,
                                password=settings['password'])


def get_share_links(protocol: str, settings: str):
    links = []
    for host in XRAY_HOSTS:
        links.append(get_share_link(host['remark'], host['hostname'], protocol, settings))
    return links


from app.xray import INBOUND_PORTS, INBOUND_STREAMS  # noqa

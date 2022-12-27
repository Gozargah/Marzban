import base64
import copy
import json
import urllib.parse as urlparse
from typing import List, Union
from uuid import UUID

import yaml
from app.xray import INBOUND_PORTS, INBOUND_STREAMS
from config import XRAY_HOSTS


class ShareLink(str):
    def __new__(cls, remark: str, host: str, protocol: str, settings: dict):
        if protocol == 'vmess':
            return cls.vmess(remark=remark,
                             address=host,
                             id=settings['id'],
                             net=INBOUND_STREAMS[protocol]['net'],
                             tls=INBOUND_STREAMS[protocol]['tls'],
                             sni=INBOUND_STREAMS[protocol]['sni'],
                             host=INBOUND_STREAMS[protocol]['sni'],
                             path=INBOUND_STREAMS[protocol]['path'])

        if protocol == 'vless':
            return cls.vless(remark=remark,
                             address=host,
                             id=settings['id'],
                             net=INBOUND_STREAMS[protocol]['net'],
                             tls=INBOUND_STREAMS[protocol]['tls'],
                             sni=INBOUND_STREAMS[protocol]['sni'],
                             host=INBOUND_STREAMS[protocol]['sni'],
                             path=INBOUND_STREAMS[protocol]['path'])

        if protocol == 'trojan':
            return cls.trojan(remark=remark,
                              address=host,
                              password=settings['password'],
                              net=INBOUND_STREAMS[protocol]['net'],
                              tls=INBOUND_STREAMS[protocol]['tls'],
                              sni=INBOUND_STREAMS[protocol]['sni'],
                              host=INBOUND_STREAMS[protocol]['sni'],
                              path=INBOUND_STREAMS[protocol]['path'])

        if protocol == 'shadowsocks':
            return cls.shadowsocks(remark=remark,
                                   address=host,
                                   password=settings['password'])

    @classmethod
    def vmess(cls,
              remark: str,
              address: str,
              id: Union[str, UUID],
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

    @classmethod
    def vless(cls,
              remark: str,
              address: str,
              id: Union[str, UUID],
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

    @classmethod
    def trojan(cls,
               remark: str,
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

    @classmethod
    def shadowsocks(cls,
                    remark: str,
                    address: str,
                    password: str,
                    security='chacha20-ietf-poly1305'):
        return "ss://" + \
            base64.b64encode(f'{security}:{password}'.encode()).decode() + \
            f"@{address}:{INBOUND_PORTS['shadowsocks']}#{urlparse.quote(remark)}"


class ClashConfiguration(object):
    def __init__(self):
        self.data = {
            'port': 7890,
            'mode': 'Global',
            'proxies': [],
            'proxy-groups': []
        }
        self.proxy_remarks = []

    def to_yaml(self):
        d = copy.deepcopy(self.data)
        d['proxy-groups'].append({'name': '♻️ Automatic',
                                  'type': 'url-test',
                                  'url': 'http://cp.cloudflare.com/',
                                  'interval': 60,
                                  'proxies': self.proxy_remarks})
        return yaml.dump(d, allow_unicode=True)

    def __str__(self) -> str:
        return self.to_yaml()

    def __repr__(self) -> str:
        return self.to_yaml()

    def _remark_validation(self, remark):
        if not remark in self.proxy_remarks:
            self.proxy_remarks.append(remark)
            return remark
        c = 2
        while True:
            new = f'{remark} ({c})'
            if not new in self.proxy_remarks:
                self.proxy_remarks.append(new)
                return new
            c += 1

    def add(self, remark: str, host: str, protocol: str, settings: dict):
        if protocol == 'vmess':
            return self.add_vmess(remark=remark,
                                  address=host,
                                  id=settings['id'],
                                  net=INBOUND_STREAMS[protocol]['net'],
                                  tls=INBOUND_STREAMS[protocol]['tls'],
                                  sni=INBOUND_STREAMS[protocol]['sni'],
                                  host=INBOUND_STREAMS[protocol]['sni'],
                                  path=INBOUND_STREAMS[protocol]['path'])

        if protocol == 'trojan':
            return self.add_trojan(remark=remark,
                                   address=host,
                                   password=settings['password'],
                                   net=INBOUND_STREAMS[protocol]['net'],
                                   tls=INBOUND_STREAMS[protocol]['tls'],
                                   sni=INBOUND_STREAMS[protocol]['sni'],
                                   host=INBOUND_STREAMS[protocol]['sni'],
                                   path=INBOUND_STREAMS[protocol]['path'])

        if protocol == 'shadowsocks':
            return self.add_shadowsocks(remark=remark,
                                        address=host,
                                        password=settings['password'])

    def add_vmess(self,
                  remark: str,
                  address: str,
                  id: Union[str, UUID],
                  host='',
                  net='tcp',
                  path='',
                  sni='',
                  tls=False):
        remark = self._remark_validation(remark)
        self.data['proxies'].append({'name': remark,
                                     'type': 'vmess',
                                     'server': address,
                                     'port': INBOUND_PORTS['vmess'],
                                     'uuid': id,
                                     'alterId': 0,
                                     'cipher': 'auto',
                                     'udp': True,
                                     'tls': tls,
                                     'servername': sni,
                                     'network': net,
                                     f'{net}-opts': {
                                         'path': path,
                                         'host': host
                                     }})

    def add_trojan(self,
                   remark: str,
                   address: str,
                   password: str,
                   net='tcp',
                   path='',
                   tls=False,
                   host='',
                   sni=''):
        remark = self._remark_validation(remark)
        self.data['proxies'].append({"name": remark,
                                     "type": "trojan",
                                     "server": address,
                                     "port": INBOUND_PORTS['trojan'],
                                     "password": password,
                                     "network": net,
                                     "udp": True,
                                     'sni': sni if tls else '',
                                     f'{net}-opts': {
                                         'path': path,
                                         'host': host
                                     }})

    def add_shadowsocks(self,
                        remark: str,
                        address: str,
                        password: str,
                        security='chacha20-ietf-poly1305'):
        remark = self._remark_validation(remark)
        self.data['proxies'].append({'name': remark,
                                     'type': 'ss',
                                     'server': address,
                                     'port': INBOUND_PORTS['shadowsocks'],
                                     'cipher': security,
                                     'password': password,
                                     'udp': True})


def get_clash_sub(username: str, proxies: dict):
    conf = ClashConfiguration()
    for host in XRAY_HOSTS:
        for proxy_type, settings in proxies.items():
            conf.add(host['remark'], host['hostname'], proxy_type, settings.dict(no_obj=True))
    return conf


def get_v2ray_sub(links: list):
    return base64.b64encode('\n'.join(links).encode()).decode()

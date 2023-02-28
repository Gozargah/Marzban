import base64
import copy
import json
import urllib.parse as urlparse
from typing import List, Union
from uuid import UUID

import yaml
from app.xray import INBOUNDS
from config import XRAY_HOSTS


class ShareLink(str):
    def __new__(cls,
                remark: str,
                address: str,
                protocol: str,
                settings: dict,
                *,
                custom_sni: str = "",
                custom_host: str = ""):
        if protocol == 'vmess':
            links = []
            for i in INBOUNDS.get(protocol, []):
                links.append(
                    cls.vmess(remark=remark,
                              address=address,
                              port=i['port'],
                              id=settings['id'],
                              net=i['stream']['net'],
                              tls=i['stream']['tls'],
                              sni=custom_sni or i['stream']['sni'],
                              host=custom_host or i['stream']['host'],
                              path=i['stream']['path'],
                              type=i['stream']['header_type'])
                )
            return '\n'.join(links)

        if protocol == 'vless':
            links = []
            for i in INBOUNDS.get(protocol, []):
                links.append(
                    cls.vless(remark=remark,
                              address=address,
                              port=i['port'],
                              id=settings['id'],
                              net=i['stream']['net'],
                              tls=i['stream']['tls'],
                              sni=custom_sni or i['stream']['sni'],
                              host=custom_host or i['stream']['host'],
                              path=i['stream']['path'],
                              type=i['stream']['header_type'])
                )
            return '\n'.join(links)

        if protocol == 'trojan':
            links = []
            for i in INBOUNDS.get(protocol, []):
                links.append(
                    cls.trojan(remark=remark,
                               address=address,
                               port=i['port'],
                               password=settings['password'],
                               net=i['stream']['net'],
                               tls=i['stream']['tls'],
                               sni=custom_sni or i['stream']['sni'],
                               host=custom_host or i['stream']['host'],
                               path=i['stream']['path'],
                               type=i['stream']['header_type'])
                )
            return '\n'.join(links)

        if protocol == 'shadowsocks':
            links = []
            for i in INBOUNDS.get(protocol, []):
                links.append(
                    cls.shadowsocks(remark=remark,
                                    address=address,
                                    port=i['port'],
                                    password=settings['password'])
                )
            return '\n'.join(links)

    @classmethod
    def vmess(cls,
              remark: str,
              address: str,
              port: int,
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
            'port': port,
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
              port: int,
              id: Union[str, UUID],
              net='ws',
              path='',
              tls=False,
              host='',
              sni='',
              type=''):

        opts = {
            "security": "tls" if tls else "none",
            "type": net,
            "host": host,
            "sni": sni,
            "headerType": type
        }
        if net == 'grpc':
            opts['serviceName'] = urlparse.quote(path)
        else:
            opts['path'] = urlparse.quote(path)

        return "vless://" + \
            f"{id}@{address}:{port}?" + \
            urlparse.urlencode(opts) + f"#{( urlparse.quote(remark))}"

    @classmethod
    def trojan(cls,
               remark: str,
               address: str,
               port: int,
               password: str,
               net='tcp',
               path='',
               tls=False,
               host='',
               sni='',
               type=''):

        opts = {
            "security": "tls" if tls else "none",
            "type": net,
            "host": host,
            "sni": sni,
            "headerType": type
        }
        if net == 'grpc':
            opts['serviceName'] = urlparse.quote(path)
        else:
            opts['path'] = urlparse.quote(path)

        return "trojan://" + \
            f"{urlparse.quote(password, safe=':')}@{address}:{port}?" + \
            urlparse.urlencode(opts) + f"#{urlparse.quote(remark)}"

    @classmethod
    def shadowsocks(cls,
                    remark: str,
                    address: str,
                    port: int,
                    password: str,
                    security='chacha20-ietf-poly1305'):
        return "ss://" + \
            base64.b64encode(f'{security}:{password}'.encode()).decode() + \
            f"@{address}:{port}#{urlparse.quote(remark)}"


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
                                  'url': 'http://www.gstatic.com/generate_204',
                                  'interval': 300,
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

    def add(self,
            remark: str,
            address: str,
            protocol: str,
            settings: dict,
            *,
            custom_sni: str = "",
            custom_host: str = ""):
        if protocol == 'vmess':
            for i in INBOUNDS.get(protocol, []):
                self.add_vmess(remark=remark,
                               address=address,
                               port=i['port'],
                               id=settings['id'],
                               net=i['stream']['net'],
                               tls=i['stream']['tls'],
                               sni=custom_sni or i['stream']['sni'],
                               host=custom_host or i['stream']['host'],
                               path=i['stream']['path'])

        if protocol == 'trojan':
            for i in INBOUNDS.get(protocol, []):
                self.add_trojan(remark=remark,
                                address=address,
                                port=i['port'],
                                password=settings['password'],
                                net=i['stream']['net'],
                                tls=i['stream']['tls'],
                                sni=custom_sni or i['stream']['sni'],
                                host=custom_host or i['stream']['host'],
                                path=i['stream']['path'])

        if protocol == 'shadowsocks':
            for i in INBOUNDS.get(protocol, []):
                self.add_shadowsocks(remark=remark,
                                     address=address,
                                     port=i['port'],
                                     password=settings['password'])

    def add_vmess(self,
                  remark: str,
                  address: str,
                  port: int,
                  id: Union[str, UUID],
                  host='',
                  net='tcp',
                  path='',
                  sni='',
                  tls=False):
        remark = self._remark_validation(remark)
        node = {'name': remark,
                'type': 'vmess',
                'server': address,
                'port': port,
                'uuid': id,
                'alterId': 0,
                'cipher': 'auto',
                'udp': True,
                f'{net}-opts': {
                    'path': path
                }}
        if tls is True:
            node.update({'tls': tls,
                         'servername': sni,
                         'network': net})
            node[f'{net}-opts']['headers'] = {'Host': host}
        self.data['proxies'].append(node)

    def add_trojan(self,
                   remark: str,
                   address: str,
                   port: int,
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
                                     "port": port,
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
                        port: int,
                        password: str,
                        security='chacha20-ietf-poly1305'):
        remark = self._remark_validation(remark)
        self.data['proxies'].append({'name': remark,
                                     'type': 'ss',
                                     'server': address,
                                     'port': port,
                                     'cipher': security,
                                     'password': password,
                                     'udp': True})


def get_clash_sub(username: str, proxies: dict):
    conf = ClashConfiguration()
    for host in XRAY_HOSTS:
        for proxy_type, settings in proxies.items():
            conf.add(host['remark'],
                     host['address'],
                     proxy_type,
                     settings.dict(no_obj=True),
                     custom_sni=host['sni'],
                     custom_host=host['host'])
    return conf


def get_v2ray_sub(links: list):
    return base64.b64encode('\n'.join(links).encode()).decode()

import base64
import copy
import json
import secrets
import urllib.parse as urlparse
from typing import Union
from uuid import UUID

import yaml

from app import xray
from app.utils.store import XrayStore
from app.utils.system import readable_size
from config import SERVER_IP
from datetime import datetime as dt


class FormatVariables(dict):
    def __missing__(self, key):
        return key.join("{}")


class V2rayShareLink(str):
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

    def add(self, remark: str, address: str, inbound: dict, settings: dict):
        if inbound['protocol'] == 'vmess':
            self.add_vmess(remark=remark,
                           address=address,
                           port=inbound['port'],
                           id=settings['id'],
                           net=inbound['network'],
                           tls=inbound['tls'],
                           sni=inbound['sni'],
                           host=inbound['host'],
                           path=inbound['path'])

        if inbound['protocol'] == 'trojan':
            self.add_trojan(remark=remark,
                            address=address,
                            port=inbound['port'],
                            password=settings['password'],
                            net=inbound['network'],
                            tls=inbound['tls'],
                            sni=inbound['sni'],
                            host=inbound['host'],
                            path=inbound['path'])

        if inbound['protocol'] == 'shadowsocks':
            self.add_shadowsocks(remark=remark,
                                 address=address,
                                 port=inbound['port'],
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
        if host:
            node[f'{net}-opts']['headers'] = {'Host': host}
        if tls:
            node.update({'tls': tls,
                         'servername': sni,
                         'network': net})
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


def get_v2ray_link(remark: str, address: str, inbound: dict, settings: dict):
    if inbound['protocol'] == 'vmess':
        return V2rayShareLink.vmess(remark=remark,
                                    address=address,
                                    port=inbound['port'],
                                    id=settings['id'],
                                    net=inbound['network'],
                                    tls=inbound['tls'],
                                    sni=inbound['sni'],
                                    host=inbound['host'],
                                    path=inbound['path'],
                                    type=inbound['header_type'])

    if inbound['protocol'] == 'vless':
        return V2rayShareLink.vless(remark=remark,
                                    address=address,
                                    port=inbound['port'],
                                    id=settings['id'],
                                    net=inbound['network'],
                                    tls=inbound['tls'],
                                    sni=inbound['sni'],
                                    host=inbound['host'],
                                    path=inbound['path'],
                                    type=inbound['header_type'])

    if inbound['protocol'] == 'trojan':
        return V2rayShareLink.trojan(remark=remark,
                                     address=address,
                                     port=inbound['port'],
                                     password=settings['password'],
                                     net=inbound['network'],
                                     tls=inbound['tls'],
                                     sni=inbound['sni'],
                                     host=inbound['host'],
                                     path=inbound['path'],
                                     type=inbound['header_type'])

    if inbound['protocol'] == 'shadowsocks':
        return V2rayShareLink.shadowsocks(remark=remark,
                                          address=address,
                                          port=inbound['port'],
                                          password=settings['password'])


def generate_v2ray_links(proxies: dict, inbounds: dict, extra_data: dict) -> list:
    links = []
    salt = secrets.token_urlsafe(12).lower()

    if (extra_data.get('expire') or 0) > 0:
        days_left = (dt.fromtimestamp(extra_data['expire']) - dt.now()).days + 1
        if not days_left > 0:
            days_left = 0
    else:
        days_left = '∞'

    data_limit = readable_size(extra_data.get('data_limit')) \
        if extra_data.get('data_limit') else '∞'

    format_variables = FormatVariables({
        "SERVER_IP": SERVER_IP,
        "USERNAME": extra_data.get('username', '{USERNAME}'),
        "DATA_USAGE": readable_size(extra_data.get('used_traffic')),
        "DATA_LIMIT": data_limit,
        "DAYS_LEFT": days_left
    })

    for protocol, tags in inbounds.items():
        settings = proxies.get(protocol)
        if not settings:
            continue

        format_variables.update({"PROTOCOL": protocol.name})
        for tag in tags:
            inbound = xray.config.inbounds_by_tag.get(tag)
            if not inbound:
                continue

            format_variables.update({"TRANSPORT": inbound['network']})
            inbound = inbound.copy()
            for host in XrayStore.HOSTS.get(tag, []):
                inbound.update({
                    'port': host['port'] or inbound['port'],
                    'sni': (host['sni'] or inbound['sni']).replace('*', salt),
                    'host': (host['host'] or inbound['host']).replace('*', salt),
                    # None means host tls complies with inbound's tls settings.
                    'tls': inbound['tls'] if host['tls'] is None else host['tls']
                })
                links.append(get_v2ray_link(remark=host['remark'].format_map(format_variables),
                                            address=host['address'].format_map(format_variables),
                                            inbound=inbound,
                                            settings=settings.dict()))

    return links


def generate_v2ray_subscription(links: list) -> str:
    return base64.b64encode('\n'.join(links).encode()).decode()


def generate_clash_subscription(proxies: dict, inbounds: dict, extra_data: dict) -> str:
    conf = ClashConfiguration()
    salt = secrets.token_urlsafe(12).lower()

    if (extra_data.get('expire') or 0) > 0:
        days_left = (dt.fromtimestamp(extra_data['expire']) - dt.now()).days + 1
        if not days_left > 0:
            days_left = 0
    else:
        days_left = '∞'

    data_limit = readable_size(extra_data.get('data_limit')) \
        if extra_data.get('data_limit') else '∞'

    format_variables = FormatVariables({
        "SERVER_IP": SERVER_IP,
        "USERNAME": extra_data.get('username', '{USERNAME}'),
        "DATA_USAGE": readable_size(extra_data.get('used_traffic')),
        "DATA_LIMIT": data_limit,
        "DAYS_LEFT": days_left
    })

    for protocol, tags in inbounds.items():
        settings = proxies.get(protocol)
        if not settings:
            continue

        format_variables.update({"PROTOCOL": protocol.name})
        for tag in tags:
            inbound = xray.config.inbounds_by_tag.get(tag)
            if not inbound:
                continue

            format_variables.update({"TRANSPORT": inbound['network']})
            inbound = inbound.copy()
            for host in XrayStore.HOSTS.get(tag, []):
                inbound.update({
                    'port': host['port'] or inbound['port'],
                    'sni': (host['sni'] or inbound['sni']).replace('*', salt),
                    'host': (host['host'] or inbound['host']).replace('*', salt),
                    # None means host tls complies with inbound's tls settings.
                    'tls': inbound['tls'] if host['tls'] is None else host['tls']
                })
                conf.add(
                    remark=host['remark'].format_map(format_variables),
                    address=host['address'].format_map(format_variables),
                    inbound=inbound,
                    settings=settings.dict(no_obj=True),
                )

    return conf.to_yaml()

import base64
import json
import random
import secrets
import urllib.parse as urlparse
from datetime import datetime as dt
from typing import TYPE_CHECKING, Literal, Union
from uuid import UUID

import yaml

from app import xray
from app.models.proxy import FormatVariables, ProxyTypes
from app.models import proxy_share
from app.templates import render_template
from app.utils.system import get_public_ip, readable_size

if TYPE_CHECKING:
    from app.models.user import UserResponse

from config import CLASH_SUBSCRIPTION_TEMPLATE


SERVER_IP = get_public_ip()



class ClashConfiguration:
    def __init__(self):
        self.data = {
            'proxies': [],
            'proxy-groups': [],
            # Some clients rely on "rules" option and will fail without it.
            'rules': []
        }
        self.proxy_remarks = []

    def to_yaml(self):
        return yaml.dump(
            yaml.load(
                render_template(
                    CLASH_SUBSCRIPTION_TEMPLATE,
                    {"conf": self.data, "proxy_remarks": self.proxy_remarks}
                ),
                Loader=yaml.SafeLoader
            ),
            sort_keys=False,
            allow_unicode=True
        )

    def __str__(self) -> str:
        return self.to_yaml()

    def __repr__(self) -> str:
        return self.to_yaml()

    def _remark_validation(self, remark):
        if remark not in self.proxy_remarks:
            return remark
        c = 2
        while True:
            new = f'{remark} ({c})'
            if new not in self.proxy_remarks:
                return new
            c += 1

    def make_node(self,
                  name: str,
                  type: str,
                  server: str,
                  port: int,
                  network: str,
                  tls: bool,
                  sni: str,
                  host: str,
                  path: str,
                  udp: bool = True,
                  alpn: str = ''):
        remark = self._remark_validation(name)
        node = {
            'name': remark,
            'type': type,
            'server': server,
            'port': port,
            'network': network,
            f'{network}-opts': {},
            'udp': udp
        }

        if type == 'ss':  # shadowsocks
            return node

        if tls:
            node['tls'] = True
            if type == 'trojan':
                node['sni'] = sni
            else:
                node['servername'] = sni
            if alpn:
                node['alpn'] = alpn.split(',')

        net_opts = node[f'{network}-opts']

        if network == 'ws':
            if path:
                net_opts['path'] = path
            if host:
                net_opts['headers'] = {"Host": host}

        if network == 'grpc':
            if path:
                net_opts['grpc-service-name'] = path

        if network == 'h2':
            if path:
                net_opts['path'] = path
            if host:
                net_opts['host'] = [host]

        if network == 'http' or network == 'tcp':
            if path:
                net_opts['method'] = 'GET'
                net_opts['path'] = [path]
            if host:
                net_opts['method'] = 'GET'
                net_opts['headers'] = {"Host": host}

        return node

    def add(self, remark: str, address: str, inbound: dict, settings: dict):
        node = self.make_node(
            name=remark,
            type=inbound['protocol'],
            server=address,
            port=inbound['port'],
            network=inbound['network'],
            tls=(inbound['tls'] == 'tls'),
            sni=inbound['sni'],
            host=inbound['host'],
            path=inbound['path'],
            udp=True,
            alpn=inbound.get('alpn', ''),
        )

        if inbound['protocol'] == 'vmess':
            node['uuid'] = settings['id']
            node['alterId'] = 0
            node['cipher'] = 'auto'
            self.data['proxies'].append(node)
            self.proxy_remarks.append(remark)

        if inbound['protocol'] == 'trojan':
            node['password'] = settings['password']
            self.data['proxies'].append(node)
            self.proxy_remarks.append(remark)

        if inbound['protocol'] == 'shadowsocks':
            node['password'] = settings['password']
            self.data['proxies'].append(node)
            self.proxy_remarks.append(remark)


class ClashMetaConfiguration(ClashConfiguration):
    def make_node(self,
                  name: str,
                  type: str,
                  server: str,
                  port: int,
                  network: str,
                  tls: bool,
                  sni: str,
                  host: str,
                  path: str,
                  udp: bool = True,
                  alpn: str = '',
                  fp: str = '',
                  pbk: str = '',
                  sid: str = ''):
        node = super().make_node(
            name=name,
            type=type,
            server=server,
            port=port,
            network=network,
            tls=tls,
            sni=sni,
            host=host,
            path=path,
            udp=udp,
            alpn=alpn
        )
        if fp:
            node['client-fingerprint'] = fp
        if pbk:
            node['reality-opts'] = {"public-key": pbk, "short-id": sid}

        return node

    def add(self, remark: str, address: str, inbound: dict, settings: dict):
        node = self.make_node(
            name=remark,
            type=inbound['protocol'],
            server=address,
            port=inbound['port'],
            network=inbound['network'],
            tls=(inbound['tls'] in ('tls', 'reality')),
            sni=inbound['sni'],
            host=inbound['host'],
            path=inbound['path'],
            udp=True,
            alpn=inbound.get('alpn', ''),
            fp=inbound.get('fp', ''),
            pbk=inbound.get('pbk', ''),
            sid=inbound.get('sid', ''),
        )

        if inbound['protocol'] == 'vmess':
            node['uuid'] = settings['id']
            node['alterId'] = 0
            node['cipher'] = 'auto'
            self.data['proxies'].append(node)
            self.proxy_remarks.append(remark)

        if inbound['protocol'] == 'vless':
            node['uuid'] = settings['id']

            if inbound['network'] in ('tcp', 'kcp'):
                node['flow'] = settings.get('flow', '')

            self.data['proxies'].append(node)
            self.proxy_remarks.append(remark)

        if inbound['protocol'] == 'trojan':
            node['password'] = settings['password']

            if inbound['network'] in ('tcp', 'kcp'):
                node['flow'] = settings.get('flow', '')

            self.data['proxies'].append(node)
            self.proxy_remarks.append(remark)

        if inbound['protocol'] == 'shadowsocks':
            node['password'] = settings['password']
            self.data['proxies'].append(node)
            self.proxy_remarks.append(remark)


def generate_proxy_share(
        remark: str,
        address: str,
        inbound: dict,
        settings: dict
) -> proxy_share.ProxyShare:
    protocol = inbound['protocol']
    proxy_shared_params = {
        'remark': remark,
        'address': address,
        **inbound
    }
    if protocol in [ProxyTypes.VLESS, ProxyTypes.Trojan]:  # VMessAEAD
        inbound_to_vmess_aead = {
            'type': inbound.get('network', None),
            'security': inbound.get('tls', None)
        }
        return proxy_share.VMessAEAD(**{
            'id': settings.get('password', None),
            **proxy_shared_params,
            **settings,
            **inbound_to_vmess_aead})
    elif protocol == ProxyTypes.VMess:  # VMessQRCode
        return proxy_share.VMessQRCode(**proxy_shared_params, **settings)
    else:
        return proxy_share.Shadowsocks(**proxy_shared_params, **settings)


def generate_v2ray_links(proxies: dict, inbounds: dict, extra_data: dict) -> list:
    links = []
    salt = secrets.token_hex(8)

    if (extra_data.get('expire') or 0) > 0:
        days_left = (dt.fromtimestamp(extra_data['expire']) - dt.now()).days + 1
        if not days_left > 0:
            days_left = 0
    else:
        days_left = '∞'

    if extra_data.get('data_limit'):
        data_limit = readable_size(extra_data['data_limit'])

        data_left = extra_data['data_limit'] - extra_data['used_traffic']
        if data_left < 0:
            data_left = 0
        data_left = readable_size(data_left)
    else:
        data_limit = '∞'
        data_left = '∞'

    format_variables = FormatVariables({
        "SERVER_IP": SERVER_IP,
        "USERNAME": extra_data.get('username', '{USERNAME}'),
        "DATA_USAGE": readable_size(extra_data.get('used_traffic')),
        "DATA_LIMIT": data_limit,
        "DATA_LEFT": data_left,
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
            host_inbound = inbound.copy()
            for host in xray.hosts.get(tag, []):
                try:
                    sni = ''
                    sni_list = host['sni'] or inbound['sni']
                    if sni_list:
                        sni = random.choice(sni_list).replace('*', salt)

                    req_host = ''
                    req_host_list = host['host'] or inbound['host']
                    if req_host_list:
                        req_host = random.choice(req_host_list).replace('*', salt)

                    host_inbound.update({
                        'port': host['port'] or inbound['port'],
                        'sni': sni,
                        'host': req_host,
                        # None means host tls complies with inbound's tls settings.
                        'tls': inbound['tls'] if host['tls'] is None else host['tls'],
                        'alpn': host['alpn'] or inbound.get('alpn', ''),
                        'fp': host['fingerprint'] or inbound.get('fp', '')
                    })
                    links.append(
                        generate_proxy_share(
                            remark=host['remark'].format_map(format_variables),
                            address=host['address'].format_map(format_variables),
                            inbound=host_inbound,
                            settings=settings.dict(no_obj=True)).dump_link()
                    )
                except Exception as e:
                    import traceback
                    traceback.print_exc()
                    raise e

    return links


def generate_v2ray_subscription(links: list) -> str:
    return base64.b64encode('\n'.join(links).encode()).decode()


def generate_clash_subscription(proxies: dict,
                                inbounds: dict,
                                extra_data: dict,
                                is_meta: bool = False) -> str:
    if is_meta is True:
        conf = ClashMetaConfiguration()
    else:
        conf = ClashConfiguration()

    salt = secrets.token_hex(8)

    if (extra_data.get('expire') or 0) > 0:
        days_left = (dt.fromtimestamp(extra_data['expire']) - dt.now()).days + 1
        if not days_left > 0:
            days_left = 0
    else:
        days_left = '∞'

    if extra_data.get('data_limit'):
        data_limit = readable_size(extra_data['data_limit'])
        data_left = extra_data['data_limit'] - extra_data['used_traffic']
        if data_left < 0:
            data_left = 0
        data_left = readable_size(data_left)
    else:
        data_limit = '∞'
        data_left = '∞'

    format_variables = FormatVariables({
        "SERVER_IP": SERVER_IP,
        "USERNAME": extra_data.get('username', '{USERNAME}'),
        "DATA_USAGE": readable_size(extra_data.get('used_traffic')),
        "DATA_LIMIT": data_limit,
        "DATA_LEFT": data_left,
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
            host_inbound = inbound.copy()
            for host in xray.hosts.get(tag, []):
                sni = ''
                sni_list = host['sni'] or inbound['sni']
                if sni_list:
                    sni = random.choice(sni_list).replace('*', salt)

                req_host = ''
                req_host_list = host['host'] or inbound['host']
                if req_host_list:
                    req_host = random.choice(req_host_list).replace('*', salt)

                host_inbound.update({
                    'port': host['port'] or inbound['port'],
                    'sni': sni,
                    'host': req_host,
                    # None means host tls complies with inbound's tls settings.
                    'tls': inbound['tls'] if host['tls'] is None else host['tls'],
                    'alpn': host['alpn'] or inbound.get('alpn', ''),
                    'fp': host['fingerprint'] or inbound.get('fp', '')
                })
                conf.add(
                    remark=host['remark'].format_map(format_variables),
                    address=host['address'].format_map(format_variables),
                    inbound=host_inbound,
                    settings=settings.dict(no_obj=True),
                )

    return conf.to_yaml()


def generate_subscription(
    user: "UserResponse",
    config_format: Literal["v2ray", "clash-meta", "clash"],
    as_base64: bool
) -> str:
    kwargs = {"proxies": user.proxies, "inbounds": user.inbounds, "extra_data": user.__dict__}

    if config_format == 'v2ray':
        config = "\n".join(generate_v2ray_links(**kwargs))
    elif config_format == 'clash-meta':
        config = generate_clash_subscription(**kwargs, is_meta=True)
    elif config_format == 'clash':
        config = generate_clash_subscription(**kwargs)
    else:
        raise ValueError(f'Unsupported format "{config_format}"')

    if as_base64:
        config = base64.b64encode(config.encode()).decode()

    return config

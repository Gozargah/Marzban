import yaml
import json
from app.templates import render_template

from config import CLASH_SUBSCRIPTION_TEMPLATE, MUX_TEMPLATE


class ClashConfiguration(object):
    def __init__(self):
        self.data = {
            'proxies': [],
            'proxy-groups': [],
            # Some clients rely on "rules" option and will fail without it.
            'rules': []
        }
        self.proxy_remarks = []
        self.mux_template = render_template(MUX_TEMPLATE)

    def render(self):
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
        return self.render()

    def __repr__(self) -> str:
        return self.render()

    def _remark_validation(self, remark):
        if not remark in self.proxy_remarks:
            return remark
        c = 2
        while True:
            new = f'{remark} ({c})'
            if not new in self.proxy_remarks:
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
                  headers: str = '',
                  udp: bool = True,
                  alpn: str = '',
                  ais: bool = '',
                  mux_enable : bool = False):

        if type == 'shadowsocks':
            type = 'ss'
        if network == 'tcp' and headers == 'http':
            network = 'http'

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

        if "?ed=" in path:
            path, max_early_data = path.split("?ed=")
            max_early_data, = max_early_data.split("/")
            max_early_data = int(max_early_data)
            early_data_header_name = "Sec-WebSocket-Protocol"
        else:
            max_early_data = None

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
            if ais:
                node['skip-cert-verify'] = ais

        net_opts = node[f'{network}-opts']

        if network == 'http':
            if path:
                net_opts['method'] = 'GET'
                net_opts['path'] = [path]
            if host:
                net_opts['method'] = 'GET'
                net_opts['Host'] = host

        if network == 'ws' or network == 'httpupgrade':
            if path:
                net_opts['path'] = path
            if host:
                net_opts['headers'] = {"Host": host}
            if max_early_data:
                net_opts['max-early-data'] = max_early_data
                net_opts['early-data-header-name'] = early_data_header_name
            if network == 'httpupgrade':
                net_opts['v2ray-http-upgrade'] = True
                if max_early_data:
                    net_opts['v2ray-http-upgrade-fast-open'] = True

        if network == 'grpc':
            if path:
                net_opts['grpc-service-name'] = path

        if network == 'h2':
            if path:
                net_opts['path'] = path
            if host:
                net_opts['host'] = [host]

        if network == 'tcp':
            if path:
                net_opts['method'] = 'GET'
                net_opts['path'] = [path]
            if host:
                net_opts['method'] = 'GET'
                net_opts['headers'] = {"Host": host}

        mux_json = json.loads(self.mux_template)
        mux_config = mux_json["clash"]

        net_opts['smux'] = mux_config
        if net_opts['smux']["enabled"]:
            net_opts['smux']["enabled"] = mux_enable

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
            headers=inbound['header_type'],
            udp=True,
            alpn=inbound.get('alpn', ''),
            ais=inbound.get('ais', ''),
            mux_enable=inbound.get('mux_enable', '')
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
            node['cipher'] = settings['method']
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
                  headers: str = '',
                  udp: bool = True,
                  alpn: str = '',
                  fp: str = '',
                  pbk: str = '',
                  sid: str = '',
                  ais: bool = '',
                  mux_enable : bool = False):
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
            headers=headers,
            udp=udp,
            alpn=alpn,
            ais=ais,
            mux_enable=mux_enable
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
            headers=inbound['header_type'],
            udp=True,
            alpn=inbound.get('alpn', ''),
            fp=inbound.get('fp', ''),
            pbk=inbound.get('pbk', ''),
            sid=inbound.get('sid', ''),
            ais=inbound.get('ais', ''),
            mux_enable=inbound.get('mux_enable', '')
        )

        if inbound['protocol'] == 'vmess':
            node['uuid'] = settings['id']
            node['alterId'] = 0
            node['cipher'] = 'auto'
            self.data['proxies'].append(node)
            self.proxy_remarks.append(remark)

        if inbound['protocol'] == 'vless':
            node['uuid'] = settings['id']

            if inbound['network'] in ('tcp', 'kcp') and inbound['header_type'] != 'http':
                node['flow'] = settings.get('flow', '')

            self.data['proxies'].append(node)
            self.proxy_remarks.append(remark)

        if inbound['protocol'] == 'trojan':
            node['password'] = settings['password']

            if inbound['network'] in ('tcp', 'kcp') and inbound['header_type'] != 'http' and inbound['tls']:
                node['flow'] = settings.get('flow', '')

            self.data['proxies'].append(node)
            self.proxy_remarks.append(remark)

        if inbound['protocol'] == 'shadowsocks':
            node['password'] = settings['password']
            node['cipher'] = settings['method']
            self.data['proxies'].append(node)
            self.proxy_remarks.append(remark)
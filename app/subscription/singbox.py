import copy
import json
from random import choice

from app.utils.helpers import UUIDEncoder
from jinja2.exceptions import TemplateNotFound

from app.subscription.funcs import get_grpc_gun
from app.templates import render_template
from config import (
    MUX_TEMPLATE,
    SINGBOX_SETTINGS_TEMPLATE,
    SINGBOX_SUBSCRIPTION_TEMPLATE,
    USER_AGENT_TEMPLATE
)


class SingBoxConfiguration(str):

    def __init__(self):
        self.proxy_remarks = []
        self.config = json.loads(render_template(SINGBOX_SUBSCRIPTION_TEMPLATE))
        self.mux_template = render_template(MUX_TEMPLATE)
        user_agent_data = json.loads(render_template(USER_AGENT_TEMPLATE))

        if 'list' in user_agent_data and isinstance(user_agent_data['list'], list):
            self.user_agent_list = user_agent_data['list']
        else:
            self.user_agent_list = []

        try:
            self.settings = json.loads(render_template(SINGBOX_SETTINGS_TEMPLATE))
        except TemplateNotFound:
            self.settings = {}

        del user_agent_data

    def _remark_validation(self, remark):
        if not remark in self.proxy_remarks:
            return remark
        c = 2
        while True:
            new = f'{remark} ({c})'
            if not new in self.proxy_remarks:
                return new
            c += 1

    def add_outbound(self, outbound_data):
        self.config["outbounds"].append(outbound_data)

    def render(self, reverse=False):
        urltest_types = ["vmess", "vless", "trojan", "shadowsocks"]
        urltest_tags = [outbound["tag"]
                        for outbound in self.config["outbounds"] if outbound["type"] in urltest_types]
        selector_types = ["vmess", "vless", "trojan", "shadowsocks", "urltest"]
        selector_tags = [outbound["tag"]
                         for outbound in self.config["outbounds"] if outbound["type"] in selector_types]

        for outbound in self.config["outbounds"]:
            if outbound.get("type") == "urltest":
                outbound["outbounds"] = urltest_tags

        for outbound in self.config["outbounds"]:
            if outbound.get("type") == "selector":
                outbound["outbounds"] = selector_tags

        if reverse:
            self.config["outbounds"].reverse()
        return json.dumps(self.config, indent=4,cls=UUIDEncoder)

    @staticmethod
    def tls_config(sni=None, fp=None, tls=None, pbk=None,
                   sid=None, alpn=None, ais=None):

        config = {}
        if tls in ['tls', 'reality']:
            config["enabled"] = True

        if sni is not None:
            config["server_name"] = sni

        if tls == 'tls' and ais:
            config['insecure'] = ais

        if tls == 'reality':
            config["reality"] = {"enabled": True}
            if pbk:
                config["reality"]["public_key"] = pbk
            if sid:
                config["reality"]["short_id"] = sid

        if fp:
            config["utls"] = {
                "enabled": bool(fp),
                "fingerprint": fp
            }

        if alpn:
            config["alpn"] = [alpn] if not isinstance(alpn, list) else alpn

        return config

    def http_config(self, host='', path='', random_user_agent: bool = False):
        config = copy.deepcopy(self.settings.get("httpSettings", {
            "idle_timeout": "15s",
            "ping_timeout": "15s",
            "method": "GET",
            "headers": {}
        }))
        if "headers" not in config:
            config["headers"] = {}

        config["host"] = []
        if path:
            config["path"] = path
        if host:
            config["host"] = [host]
        if random_user_agent:
            config["headers"]["User-Agent"] = choice(self.user_agent_list)

        return config

    def ws_config(self, host='', path='', random_user_agent: bool = False,
                  max_early_data=None, early_data_header_name=None):
        config = copy.deepcopy(self.settings.get("wsSettings", {
            "headers": {}
        }))
        if "headers" not in config:
            config["headers"] = {}

        if path:
            config["path"] = path
        if host:
            config["headers"]["Host"] = host
        if random_user_agent:
            config["headers"]["User-Agent"] = choice(self.user_agent_list)
        if max_early_data is not None:
            config["max_early_data"] = max_early_data
        if early_data_header_name:
            config["early_data_header_name"] = early_data_header_name

        return config

    def grpc_config(self, path=''):
        config = copy.deepcopy(self.settings.get("grpcSettings", {}))

        if path:
            config["service_name"] = path

        return config

    def httpupgrade_config(self, host='', path='', random_user_agent: bool = False):
        config = copy.deepcopy(self.settings.get("httpupgradeSettings", {
            "headers": {}
        }))
        if "headers" not in config:
            config["headers"] = {}

        config["host"] = host
        if path:
            config["path"] = path
        if random_user_agent:
            config["headers"]["User-Agent"] = choice(self.user_agent_list)

        return config

    def transport_config(self,
                         transport_type='',
                         host='',
                         path='',
                         max_early_data=None,
                         early_data_header_name=None,
                         random_user_agent: bool = False,
                         ):

        transport_config = {}

        if transport_type:
            if transport_type == "http":
                transport_config = self.http_config(
                    host=host,
                    path=path,
                    random_user_agent=random_user_agent,
                )

            elif transport_type == "ws":
                transport_config = self.ws_config(
                    host=host,
                    path=path,
                    random_user_agent=random_user_agent,
                    max_early_data=max_early_data,
                    early_data_header_name=early_data_header_name,
                )

            elif transport_type == "grpc":
                transport_config = self.grpc_config(path=path)

            elif transport_type == "httpupgrade":
                transport_config = self.httpupgrade_config(
                    host=host,
                    path=path,
                    random_user_agent=random_user_agent,
                )

        transport_config['type'] = transport_type
        return transport_config

    def make_outbound(self,
                      type: str,
                      remark: str,
                      address: str,
                      port: int,
                      net='',
                      path='',
                      host='',
                      flow='',
                      tls='',
                      sni='',
                      fp='',
                      alpn='',
                      pbk='',
                      sid='',
                      headers='',
                      ais='',
                      mux_enable: bool = False,
                      random_user_agent: bool = False,
                      ):

        if isinstance(port, str):
            ports = port.split(',')
            port = int(choice(ports))

        config = {
            "type": type,
            "tag": remark,
            "server": address,
            "server_port": port,
        }

        if net in ('tcp', 'raw', 'kcp') and headers != 'http' and (tls or tls != 'none'):
            if flow:
                config["flow"] = flow

        if net == 'h2':
            net = 'http'
            alpn = 'h2'
        elif net == 'h3':
            net = 'http'
            alpn = 'h3'
        elif net in ['tcp', 'raw'] and headers == 'http':
            net = 'http'

        if net in ['http', 'ws', 'quic', 'grpc', 'httpupgrade']:
            max_early_data = None
            early_data_header_name = None

            if "?ed=" in path:
                path, max_early_data = path.split("?ed=")
                max_early_data, = max_early_data.split("/")
                max_early_data = int(max_early_data)
                early_data_header_name = "Sec-WebSocket-Protocol"

            config['transport'] = self.transport_config(
                transport_type=net,
                host=host,
                path=path,
                max_early_data=max_early_data,
                early_data_header_name=early_data_header_name,
                random_user_agent=random_user_agent,
            )

        if tls in ('tls', 'reality'):
            config['tls'] = self.tls_config(sni=sni, fp=fp, tls=tls,
                                            pbk=pbk, sid=sid, alpn=alpn,
                                            ais=ais)

        mux_json = json.loads(self.mux_template)
        mux_config = mux_json["sing-box"]

        config['multiplex'] = mux_config
        if config['multiplex']["enabled"]:
            config['multiplex']["enabled"] = mux_enable

        return config

    def add(self, remark: str, address: str, inbound: dict, settings: dict):

        net = inbound["network"]
        path = inbound["path"]

        # not supported by sing-box
        if net in ("kcp", "splithttp", "xhttp") or (net == "quic" and inbound["header_type"] != "none"):
            return

        if net in ("grpc", "gun"):
            path = get_grpc_gun(path)

        alpn = inbound.get('alpn', None)

        remark = self._remark_validation(remark)
        self.proxy_remarks.append(remark)

        outbound = self.make_outbound(
            remark=remark,
            type=inbound['protocol'],
            address=address,
            port=inbound['port'],
            net=net,
            tls=(inbound['tls']),
            flow=settings.get('flow', ''),
            sni=inbound['sni'],
            host=inbound['host'],
            path=path,
            alpn=alpn.rsplit(sep=",") if alpn else None,
            fp=inbound.get('fp', ''),
            pbk=inbound.get('pbk', ''),
            sid=inbound.get('sid', ''),
            headers=inbound['header_type'],
            ais=inbound.get('ais', ''),
            mux_enable=inbound.get('mux_enable', False),
            random_user_agent=inbound.get('random_user_agent', False),)

        if inbound['protocol'] == 'vmess':
            outbound['uuid'] = settings['id']

        elif inbound['protocol'] == 'vless':
            outbound['uuid'] = settings['id']

        elif inbound['protocol'] == 'trojan':
            outbound['password'] = settings['password']

        elif inbound['protocol'] == 'shadowsocks':
            outbound['password'] = settings['password']
            outbound['method'] = settings['method']

        self.add_outbound(outbound)

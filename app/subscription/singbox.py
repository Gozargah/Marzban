import json
from app.templates import render_template

from config import SINGBOX_SUBSCRIPTION_TEMPLATE, MUX_TEMPLATE

class SingBoxConfiguration(str):

    def __init__(self):
        template = render_template(SINGBOX_SUBSCRIPTION_TEMPLATE)
        self.config = json.loads(template)
        mux_template = render_template(MUX_TEMPLATE)
        mux_json = json.loads(mux_template)
        self.mux_config = mux_json["sing-box"]

    def add_outbound(self, outbound_data):
        self.config["outbounds"].append(outbound_data)

    def render(self):
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

        return json.dumps(self.config, indent=4)

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

    @staticmethod
    def transport_config(transport_type='',
                         host='',
                         path='',
                         method='',
                         idle_timeout="15s",
                         ping_timeout="15s",
                         max_early_data=None,
                         early_data_header_name=None,
                         permit_without_stream=False):

        transport_config = {}

        if transport_type:
            transport_config['type'] = transport_type

            if transport_type == "http":
                transport_config['host'] = []
                if path:
                    transport_config['path'] = path
                if method:
                    transport_config['method'] = method
                if host:
                    transport_config["host"] = [host]
                if idle_timeout:
                    transport_config['idle_timeout'] = idle_timeout
                if ping_timeout:
                    transport_config['ping_timeout'] = ping_timeout

            elif transport_type == "ws":
                if path:
                    transport_config['path'] = path
                if host:
                    transport_config['headers'] = {'Host': host}
                if max_early_data is not None:
                    transport_config['max_early_data'] = max_early_data
                if early_data_header_name:
                    transport_config['early_data_header_name'] = early_data_header_name

            elif transport_type == "grpc":
                if path:
                    transport_config['service_name'] = path
                if idle_timeout:
                    transport_config['idle_timeout'] = idle_timeout
                if ping_timeout:
                    transport_config['ping_timeout'] = ping_timeout
                if permit_without_stream:
                    transport_config['permit_without_stream'] = permit_without_stream

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
                      mux_enable=False,
                      ):

        config = {
            "type": type,
            "tag": remark,
            "server": address,
            "server_port": port,
        }
        if net in ('tcp', 'kcp') and headers != 'http' and tls:
            if flow:
                config["flow"] = flow

        if net == 'h2':
            net = 'http'
            alpn = 'h2'
        elif net in ['tcp'] and headers == 'http':
            net = 'http'

        if net in ['http', 'ws', 'quic', 'grpc']:
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
                early_data_header_name=early_data_header_name
            )
        else:
            config["network"]: net

        if tls in ('tls', 'reality'):
            config['tls'] = self.tls_config(sni=sni, fp=fp, tls=tls,
                                            pbk=pbk, sid=sid, alpn=alpn,
                                            ais=ais)

        config['multiplex'] = self.mux_config
        config['multiplex']["enabled"] = mux_enable,

        return config

    def add(self, remark: str, address: str, inbound: dict, settings: dict):
        outbound = self.make_outbound(
            remark=remark,
            type=inbound['protocol'],
            address=address,
            port=inbound['port'],
            net=inbound['network'],
            tls=(inbound['tls']),
            flow=settings.get('flow', ''),
            sni=inbound['sni'],
            host=inbound['host'],
            path=inbound['path'],
            alpn=inbound.get('alpn', ''),
            fp=inbound.get('fp', ''),
            pbk=inbound.get('pbk', ''),
            sid=inbound.get('sid', ''),
            headers=inbound['header_type'],
            ais=inbound.get('ais', ''),
            mux_enable=inbound.get('mux_enable', False))

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
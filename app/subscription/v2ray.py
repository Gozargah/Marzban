import base64
import json
import urllib.parse as urlparse
from typing import Union
from uuid import UUID

from app.templates import render_template

from config import (MUX_TEMPLATE, V2RAY_SUBSCRIPTION_TEMPLATE)


class V2rayShareLink(str):
    @classmethod
    def vmess(
        cls,
        remark: str,
        address: str,
        port: int,
        id: Union[str, UUID],
        host="",
        net="tcp",
        path="",
        type="",
        tls="none",
        sni="",
        fp="",
        alpn="",
        pbk="",
        sid="",
        spx="",
        ais="",
        fs="",
    ):
        payload = {
            "add": address,
            "aid": "0",
            "host": host,
            "id": str(id),
            "net": net,
            "path": path,
            "port": port,
            "fragment": fs,
            "ps": remark,
            "scy": "auto",
            "tls": tls,
            "type": type,
            "v": "2",
        }

        if tls == "tls":
            payload["sni"] = sni
            payload["fp"] = fp
            payload["alpn"] = alpn
            if ais:
                payload["allowInsecure"] = 1
        elif tls == "reality":
            payload["sni"] = sni
            payload["fp"] = fp
            payload["pbk"] = pbk
            payload["sid"] = sid
            payload["spx"] = spx

        return (
            "vmess://"
            + base64.b64encode(
                json.dumps(payload, sort_keys=True).encode("utf-8")
            ).decode()
        )

    @classmethod
    def vless(cls,
              remark: str,
              address: str,
              port: int,
              id: Union[str, UUID],
              net='ws',
              path='',
              host='',
              type='',
              flow='',
              tls='none',
              sni='',
              fp='',
              alpn='',
              pbk='',
              sid='',
              spx='',
              ais='',
              fs="",
              ):

        payload = {
            "security": tls,
            "type": net,
            "headerType": type
        }
        if flow and (tls in ('tls', 'reality') and net in ('tcp', 'kcp') and type != 'http'):
            payload['flow'] = flow

        if net == 'grpc':
            payload['serviceName'] = path
            payload["host"] = host
        elif net == 'quic':
            payload['key'] = path
            payload["quicSecurity"] = host
        else:
            payload["path"] = path
            payload["host"] = host

        if tls == "tls":
            payload["sni"] = sni
            payload["fp"] = fp
            payload["alpn"] = alpn
            payload["fragment"] = fs
            if ais:
                payload["allowInsecure"] = 1
        elif tls == "reality":
            payload["sni"] = sni
            payload["fp"] = fp
            payload["pbk"] = pbk
            payload["sid"] = sid
            payload["spx"] = spx

        return (
            "vless://"
            + f"{id}@{address}:{port}?"
            + urlparse.urlencode(payload)
            + f"#{( urlparse.quote(remark))}"
        )

    @classmethod
    def trojan(cls,
               remark: str,
               address: str,
               port: int,
               password: str,
               net='tcp',
               path='',
               host='',
               type='',
               flow='',
               tls='none',
               sni='',
               fp='',
               alpn='',
               pbk='',
               sid='',
               spx='',
               ais='',
               fs="",
               ):

        payload = {
            "security": tls,
            "type": net,
            "headerType": type
        }
        if flow and (tls in ('tls', 'reality') and net in ('tcp', 'kcp') and type != 'http'):
            payload['flow'] = flow

        if net == 'grpc':
            payload['serviceName'] = path
            payload["host"] = host
        elif net == 'quic':
            payload['key'] = path
            payload["quicSecurity"] = host
        else:
            payload["path"] = path
            payload["host"] = host

        if tls == "tls":
            payload["sni"] = sni
            payload["fp"] = fp
            payload["alpn"] = alpn
            payload["fragment"] = fs
            if ais:
                payload["allowInsecure"] = 1
        elif tls == "reality":
            payload["sni"] = sni
            payload["fp"] = fp
            payload["pbk"] = pbk
            payload["sid"] = sid
            payload["spx"] = spx

        return (
            "trojan://"
            + f"{urlparse.quote(password, safe=':')}@{address}:{port}?"
            + urlparse.urlencode(payload)
            + f"#{urlparse.quote(remark)}"
        )

    @classmethod
    def shadowsocks(
        cls, remark: str, address: str, port: int, password: str, method: str
    ):
        return (
            "ss://"
            + base64.b64encode(f"{method}:{password}".encode()).decode()
            + f"@{address}:{port}#{urlparse.quote(remark)}"
        )


class V2rayJsonConfig(str):

    def __init__(self):
        self.config = []
        self.template = render_template(V2RAY_SUBSCRIPTION_TEMPLATE)
        mux_template = render_template(MUX_TEMPLATE)
        mux_json = json.loads(mux_template)
        self.mux_config = mux_json["v2ray"]

    def add_outbound(self, remarks, outbound_data):
        json_template = json.loads(self.template)
        json_template["remarks"] = remarks
        json_template["outbounds"].insert(0, (outbound_data))
        self.config.insert(0, (json_template))

    def render(self):
        return json.dumps(self.config, indent=4)

    @staticmethod
    def tls_config(sni=None, fp=None, alpn=None, ais=None):

        tlsSettings = {}
        if sni is not None:
            tlsSettings["serverName"] = sni

        tlsSettings['allowInsecure'] = ais if ais else False

        if fp:
            tlsSettings["fingerprint"] = fp
        if alpn:
            tlsSettings["alpn"] = [alpn] if not isinstance(
                alpn, list) else alpn

        tlsSettings["show"] = False

        return tlsSettings

    @staticmethod
    def reality_config(sni=None, fp=None, pbk=None, sid=None):

        realitySettings = {}
        if sni is not None:
            realitySettings["serverName"] = sni
        if fp:
            realitySettings["fingerprint"] = fp

        realitySettings["show"] = False

        if pbk:
            realitySettings["publicKey"] = pbk
        if sid:
            realitySettings["shortId"] = sid

        realitySettings["spiderX"] = ""

        return realitySettings

    @staticmethod
    def ws_config(path=None, host=None):

        wsSettings = {}
        wsSettings["headers"] = {}
        if path:
            wsSettings["path"] = path
        if host:
            wsSettings["headers"]["Host"] = host

        return wsSettings

    @staticmethod
    def grpc_config(path=None, multiMode=False):

        grpcSettings = {}
        if path:
            grpcSettings["serviceName"] = path
        grpcSettings["multiMode"] = multiMode
        grpcSettings["idle_timeout"] = 60
        grpcSettings["health_check_timeout"] = 20
        grpcSettings["permit_without_stream"] = False
        grpcSettings["initial_windows_size"] = 0

        return grpcSettings

    @staticmethod
    def tcp_http_config(path=None, host=None):
        tcpSettings = {}

        if any((path, host)):
            tcpSettings["header"] = {}
            tcpSettings["header"]["type"] = "http"

            tcpSettings["request"] = {}
            tcpSettings["request"]["version"] = "1.1"

            tcpSettings["request"]["headers"] = {}
            tcpSettings["request"]["method"] = "GET"
            tcpSettings["request"]["headers"]["User-Agent"] = ""
            tcpSettings["request"]["headers"]["Accept-Encoding"] = ["gzip, deflate"],
            tcpSettings["request"]["headers"]["Connection"] = "keep-alive"
            tcpSettings["request"]["headers"]["Pragma"] = "no-cache"

            if path:
                tcpSettings["request"]["path"] = [path]

            if host:
                tcpSettings["request"]["headers"]["Host"] = [host]

        return tcpSettings

    @staticmethod
    def h2_config(path=None, host=None):

        httpSettings = {}
        if path:
            httpSettings["path"] = path
        else:
            httpSettings["path"] = ""
        if host:
            httpSettings["host"] = [host]
        else:
            httpSettings["host"] = {}

        return httpSettings

    @staticmethod
    def quic_config(path=None, host=None, header=None):

        quicSettings = {}
        quicSettings["header"] = {"none"}
        if path:
            quicSettings["key"] = path
        else:
            quicSettings["key"] = ""
        if host:
            quicSettings["security"] = [host]
        else:
            quicSettings["security"] = ""
        if header:
            quicSettings["header"]["type"] = header

        return quicSettings

    @staticmethod
    def kpc_config(path=None, host=None, header=None):

        kcpSettings = {}
        kcpSettings["header"] = {}

        kcpSettings["mtu"] = 1350
        kcpSettings["tti"] = 50
        kcpSettings["uplinkCapacity"] = 12
        kcpSettings["downlinkCapacity"] = 100
        kcpSettings["congestion"] = False,
        kcpSettings["readBufferSize"] = 2
        kcpSettings["writeBufferSize"] = 2

        if path:
            kcpSettings["seed"] = path
        if header:
            kcpSettings["header"]["type"] = header
        else:
            kcpSettings["header"]["type"] = "none"

        return kcpSettings

    @staticmethod
    def stream_setting_config(network=None, security=None,
                              network_setting=None, tls_settings=None):

        streamSettings = {}

        streamSettings["network"] = network

        if security:
            streamSettings["security"] = security
            if security == "reality":
                streamSettings["realitySettings"] = tls_settings
            elif security == "tls":
                streamSettings["tlsSettings"] = tls_settings

        if network == "ws":
            streamSettings["wsSettings"] = network_setting
        elif network == "grpc":
            streamSettings["grpcSettings"] = network_setting
        elif network == "h2":
            streamSettings["httpSettings"] = network_setting
        elif network == "kpc":
            streamSettings["kcpSettings"] = network_setting
        elif network == "tcp" and network_setting:
            streamSettings["tcpSettings"] = network_setting
        elif network == "quic":
            streamSettings["quicSettings"] = network_setting

        return streamSettings

    @staticmethod
    def vmess_config(address=None, port=None, id=None):

        vnext = {}
        users = {}

        vnext["address"] = address
        vnext["port"] = port
        users["id"] = id
        users["alterId"] = 0
        users["email"] = "https://gozargah.github.io/marzban/"
        users["security"] = "auto"
        vnext["users"] = [users]

        return [vnext]

    @staticmethod
    def vless_config(address=None, port=None, id=None, flow=None):

        vnext = {}
        users = {}

        vnext["address"] = address
        vnext["port"] = port
        users["id"] = id
        users["alterId"] = 0
        users["email"] = "https://gozargah.github.io/marzban/"
        users["security"] = "auto"
        users["encryption"] = "none"
        if flow:
            users["flow"] = flow
        vnext["users"] = [users]

        return [vnext]

    @staticmethod
    def trojan_config(address=None, port=None, password=None, method="chacha20"):

        servers = {}
        settings = {}

        servers["address"] = address
        servers["port"] = port
        servers["password"] = password
        servers["email"] = "https://gozargah.github.io/marzban/"
        servers["method"] = method
        servers["ota"] = False
        servers["level"] = 1

        settings["servers"] = [servers]

        return settings

    @staticmethod
    def shadowsocks_config(address=None, port=None, password=None, method=None):

        servers = {}
        settings = {}

        servers["address"] = address
        servers["port"] = port
        servers["password"] = password
        servers["email"] = "https://gozargah.github.io/marzban/"
        servers["method"] = method
        servers["uot"] = False
        servers["level"] = 1

        settings["servers"] = [servers]

        return settings

    def make_stream_setting(self,
                            net='',
                            path='',
                            host='',
                            tls='',
                            sni='',
                            fp='',
                            alpn='',
                            pbk='',
                            sid='',
                            headers='',
                            ais=''
                            ):

        if net == "ws":
            network_setting = self.ws_config(path=path, host=host)
        elif net == "grpc":
            network_setting = self.grpc_config(path=path)
        elif net == "h2":
            network_setting = self.h2_config(path=path, host=host)
        elif net == "kpc":
            network_setting = self.kpc_config(
                path=path, host=host, header=headers)
        elif net == "tcp":
            network_setting = self.tcp_http_config(path=path, host=host)
        elif net == "quic":
            network_setting = self.quic_config(
                path=path, host=host, header=headers)

        if tls == "tls":
            tls_settings = self.tls_config(sni=sni, fp=fp, alpn=alpn, ais=ais)
        elif tls == "reality":
            tls_settings = self.reality_config(
                sni=sni, fp=fp, pbk=pbk, sid=sid)
        else:
            tls_settings = None

        streamSettings = self.stream_setting_config(network=net, security=tls,
                                                    network_setting=network_setting,
                                                    tls_settings=tls_settings)

        return streamSettings

    def add(self, remark: str, address: str, inbound: dict, settings: dict):

        net = inbound['network']
        protocol = inbound['protocol']
        port = inbound['port']
        tls = (inbound['tls'])
        headers = inbound['header_type']

        outbound = {
            "tag": remark,
            "protocol": protocol
        }

        if inbound['protocol'] == 'vmess':
            vnext = self.vmess_config(address=address,
                                      port=port,
                                      id=settings['id'])
            outbound["settings"] = {}
            outbound["settings"]["vnext"] = vnext

        elif inbound['protocol'] == 'vless':
            if net in ('tcp', 'kcp') and headers != 'http' and tls:
                flow = settings.get('flow', '')
            else:
                flow = None
            vnext = self.vless_config(address=address,
                                      port=port,
                                      id=settings['id'],
                                      flow=flow)
            outbound["settings"] = {}
            outbound["settings"]["vnext"] = vnext

        elif inbound['protocol'] == 'trojan':
            settings = self.trojan_config(address=address,
                                          port=port,
                                          password=settings['password'])
            outbound["settings"] = settings

        elif inbound['protocol'] == 'shadowsocks':
            settings = self.shadowsocks_config(address=address,
                                               port=port,
                                               password=settings['password'],
                                               method=settings['method'])
            outbound["settings"] = settings

        outbound["streamSettings"] = self.make_stream_setting(
            net=net,
            tls=tls,
            sni=inbound['sni'],
            host=inbound['host'],
            path=inbound['path'],
            alpn=inbound.get('alpn', ''),
            fp=inbound.get('fp', ''),
            pbk=inbound.get('pbk', ''),
            sid=inbound.get('sid', ''),
            headers=headers,
            ais=inbound.get('ais', '')
        )

        outbound["mux"] = self.mux_config
        outbound["mux"]["enabled"] = bool(inbound.get('mux_enable', False))

        self.add_outbound(remarks=remark, outbound_data=outbound)

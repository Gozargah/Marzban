import base64
import copy
import json
import urllib.parse as urlparse
from random import choice
from typing import Union
from urllib.parse import quote
from uuid import UUID

from jinja2.exceptions import TemplateNotFound

from app.subscription.funcs import get_grpc_gun, get_grpc_multi
from app.templates import render_template
from app.utils.helpers import UUIDEncoder
from config import (
    EXTERNAL_CONFIG,
    GRPC_USER_AGENT_TEMPLATE,
    MUX_TEMPLATE,
    USER_AGENT_TEMPLATE,
    V2RAY_SETTINGS_TEMPLATE,
    V2RAY_SUBSCRIPTION_TEMPLATE,
)


class V2rayShareLink(str):
    def __init__(self):
        self.links = []

    def add_link(self, link):
        self.links.append(link)

    def render(self, reverse=False):
        if EXTERNAL_CONFIG:
            self.links.append(EXTERNAL_CONFIG)
        if reverse:
            self.links.reverse()
        return self.links

    def add(self, remark: str, address: str, inbound: dict, settings: dict):
        net = inbound["network"]
        multi_mode = inbound.get("multiMode", False)
        old_path: str = inbound["path"]

        if net in ["grpc", "gun"]:
            if multi_mode:
                path = get_grpc_multi(old_path)
            else:
                path = get_grpc_gun(old_path)
            if old_path.startswith("/"):
                path = quote(path, safe="-_.!~*'()")

        else:
            path = old_path

        if inbound["protocol"] == "vmess":
            link = self.vmess(
                remark=remark,
                address=address,
                port=inbound["port"],
                id=settings["id"],
                net=net,
                tls=inbound["tls"],
                sni=inbound.get("sni", ""),
                fp=inbound.get("fp", ""),
                alpn=inbound.get("alpn", ""),
                pbk=inbound.get("pbk", ""),
                sid=inbound.get("sid", ""),
                spx=inbound.get("spx", ""),
                host=inbound["host"],
                path=path,
                type=inbound["header_type"],
                ais=inbound.get("ais", ""),
                fs=inbound.get("fragment_setting", ""),
                multiMode=multi_mode,
                sc_max_each_post_bytes=inbound.get('scMaxEachPostBytes', 1000000),
                sc_max_concurrent_posts=inbound.get('scMaxConcurrentPosts', 100),
                sc_min_posts_interval_ms=inbound.get('scMinPostsIntervalMs', 30),
                x_padding_bytes=inbound.get("xPaddingBytes", "100-1000"),
                mode=inbound.get("mode", "auto"),
                noGRPCHeader=inbound.get("noGRPCHeader", False),
                uplinkHTTPMethod=inbound.get("uplinkHTTPMethod", ""),
                xPaddingKey=inbound.get("xPaddingKey", ""),
                xPaddingMethod=inbound.get("xPaddingMethod", ""),
                xPaddingObfsMode=inbound.get("xPaddingObfsMode", False),
                xPaddingPlacement=inbound.get("xPaddingPlacement", ""),
                scStreamUpServerSecs=inbound.get("scStreamUpServerSecs", ""),
                heartbeatPeriod=inbound.get("heartbeatPeriod", 0),
                keepAlivePeriod=inbound.get("keepAlivePeriod", 0),
                xmux=inbound.get("xmux", {}),
            )

        elif inbound["protocol"] == "vless":
            link = self.vless(
                remark=remark,
                address=address,
                port=inbound["port"],
                id=settings["id"],
                flow=settings.get("flow", ""),
                net=net,
                tls=inbound["tls"],
                sni=inbound.get("sni", ""),
                fp=inbound.get("fp", ""),
                alpn=inbound.get("alpn", ""),
                pbk=inbound.get("pbk", ""),
                sid=inbound.get("sid", ""),
                spx=inbound.get("spx", ""),
                host=inbound["host"],
                path=path,
                type=inbound["header_type"],
                ais=inbound.get("ais", ""),
                fs=inbound.get("fragment_setting", ""),
                multiMode=multi_mode,
                sc_max_each_post_bytes=inbound.get('scMaxEachPostBytes', 1000000),
                sc_max_concurrent_posts=inbound.get('scMaxConcurrentPosts', 100),
                sc_min_posts_interval_ms=inbound.get('scMinPostsIntervalMs', 30),
                x_padding_bytes=inbound.get("xPaddingBytes", "100-1000"),
                mode=inbound.get("mode", "auto"),
                noGRPCHeader=inbound.get("noGRPCHeader", False),
                uplinkHTTPMethod=inbound.get("uplinkHTTPMethod", ""),
                xPaddingKey=inbound.get("xPaddingKey", ""),
                xPaddingMethod=inbound.get("xPaddingMethod", ""),
                xPaddingObfsMode=inbound.get("xPaddingObfsMode", False),
                xPaddingPlacement=inbound.get("xPaddingPlacement", ""),
                scStreamUpServerSecs=inbound.get("scStreamUpServerSecs", ""),
                heartbeatPeriod=inbound.get("heartbeatPeriod", 0),
                keepAlivePeriod=inbound.get("keepAlivePeriod", 0),
                xmux=inbound.get("xmux", {}),
            )

        elif inbound["protocol"] == "trojan":
            link = self.trojan(
                remark=remark,
                address=address,
                port=inbound["port"],
                password=settings["password"],
                flow=settings.get("flow", ""),
                net=net,
                tls=inbound["tls"],
                sni=inbound.get("sni", ""),
                fp=inbound.get("fp", ""),
                alpn=inbound.get("alpn", ""),
                pbk=inbound.get("pbk", ""),
                sid=inbound.get("sid", ""),
                spx=inbound.get("spx", ""),
                host=inbound["host"],
                path=path,
                type=inbound["header_type"],
                ais=inbound.get("ais", ""),
                fs=inbound.get("fragment_setting", ""),
                multiMode=multi_mode,
                sc_max_each_post_bytes=inbound.get('scMaxEachPostBytes', 1000000),
                sc_max_concurrent_posts=inbound.get('scMaxConcurrentPosts', 100),
                sc_min_posts_interval_ms=inbound.get('scMinPostsIntervalMs', 30),
                x_padding_bytes=inbound.get("xPaddingBytes", "100-1000"),
                mode=inbound.get("mode", "auto"),
                noGRPCHeader=inbound.get("noGRPCHeader", False),
                uplinkHTTPMethod=inbound.get("uplinkHTTPMethod", ""),
                xPaddingKey=inbound.get("xPaddingKey", ""),
                xPaddingMethod=inbound.get("xPaddingMethod", ""),
                xPaddingObfsMode=inbound.get("xPaddingObfsMode", False),
                xPaddingPlacement=inbound.get("xPaddingPlacement", ""),
                scStreamUpServerSecs=inbound.get("scStreamUpServerSecs", ""),
                heartbeatPeriod=inbound.get("heartbeatPeriod", 0),
                keepAlivePeriod=inbound.get("keepAlivePeriod", 0),
                xmux=inbound.get("xmux", {}),
            )

        elif inbound["protocol"] == "shadowsocks":
            link = self.shadowsocks(
                remark=remark,
                address=address,
                port=inbound["port"],
                password=settings["password"],
                method=settings["method"],
            )
        else:
            return

        self.add_link(link=link)

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
            multiMode: bool = False,
            sc_max_each_post_bytes: int = 1000000,
            sc_max_concurrent_posts: int = 100,
            sc_min_posts_interval_ms: int = 30,
            x_padding_bytes: str = "100-1000",
            mode: str = "auto",
            noGRPCHeader: bool = False,
                         uplinkHTTPMethod: str = "",
                         xPaddingKey: str = "",
                         xPaddingMethod: str = "",
                         xPaddingObfsMode: bool = False,
                         xPaddingPlacement: str = "",
                         scStreamUpServerSecs: str = "",
            heartbeatPeriod: int = 0,
            keepAlivePeriod: int = 0,
            xmux: dict = {},
    ):
        payload = {
            "add": address,
            "aid": "0",
            "host": host,
            "id": str(id),
            "net": net,
            "path": path,
            "port": port,
            "ps": remark,
            "scy": "auto",
            "tls": tls,
            "type": type,
            "v": "2",
        }

        if fs:
            payload["fragment"] = fs

        if tls == "tls":
            payload["sni"] = sni
            payload["fp"] = fp
            if alpn:
                payload["alpn"] = alpn
            if fs:
                payload["fragment"] = fs
            if ais:
                payload["allowInsecure"] = 1

        elif tls == "reality":
            payload["sni"] = sni
            payload["fp"] = fp
            payload["pbk"] = pbk
            payload["sid"] = sid
            if spx:
                payload["spx"] = spx

        if net == "grpc":
            if multiMode:
                payload["mode"] = "multi"
            else:
                payload["mode"] = "gun"

        elif net in ("splithttp", "xhttp"):
            extra = {
                "scMaxEachPostBytes": sc_max_each_post_bytes,
                "scMaxConcurrentPosts": sc_max_concurrent_posts,
                "scMinPostsIntervalMs": sc_min_posts_interval_ms,
                "xPaddingBytes": x_padding_bytes,
                "noGRPCHeader": noGRPCHeader,
            }
            if uplinkHTTPMethod:
                extra["uplinkHTTPMethod"] = uplinkHTTPMethod
            if xPaddingKey:
                extra["xPaddingKey"] = xPaddingKey
            if xPaddingMethod:
                extra["xPaddingMethod"] = xPaddingMethod
            if xPaddingObfsMode:
                extra["xPaddingObfsMode"] = xPaddingObfsMode
            if xPaddingPlacement:
                extra["xPaddingPlacement"] = xPaddingPlacement
            if scStreamUpServerSecs:
                extra["scStreamUpServerSecs"] = scStreamUpServerSecs
            if xmux:
                extra["xmux"] = xmux
            payload["type"] = mode
            if keepAlivePeriod > 0:
                extra["keepAlivePeriod"] = keepAlivePeriod
            payload["extra"] = extra

        elif net == "ws":
            if heartbeatPeriod:
                payload["heartbeatPeriod"] = heartbeatPeriod

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
              multiMode: bool = False,
              sc_max_each_post_bytes: int = 1000000,
              sc_max_concurrent_posts: int = 100,
              sc_min_posts_interval_ms: int = 30,
              x_padding_bytes: str = "100-1000",
              mode: str = "auto",
              noGRPCHeader: bool = False,
                         uplinkHTTPMethod: str = "",
                         xPaddingKey: str = "",
                         xPaddingMethod: str = "",
                         xPaddingObfsMode: bool = False,
                         xPaddingPlacement: str = "",
                         scStreamUpServerSecs: str = "",
              heartbeatPeriod: int = 0,
              keepAlivePeriod: int = 0,
              xmux: dict = {},
              ):

        payload = {
            "security": tls,
            "type": net,
            "headerType": type
        }
        if flow and (tls in ('tls', 'reality') and net in ('tcp', 'raw', 'kcp') and type != 'http'):
            payload['flow'] = flow

        if net == 'grpc':
            payload['serviceName'] = path
            payload["authority"] = host
            if multiMode:
                payload["mode"] = "multi"
            else:
                payload["mode"] = "gun"

        elif net == 'quic':
            payload['key'] = path
            payload["quicSecurity"] = host

        elif net in ("splithttp", "xhttp"):
            payload["path"] = path
            payload["host"] = host
            payload["mode"] = mode
            extra = {
                "scMaxEachPostBytes": sc_max_each_post_bytes,
                "scMaxConcurrentPosts": sc_max_concurrent_posts,
                "scMinPostsIntervalMs": sc_min_posts_interval_ms,
                "xPaddingBytes": x_padding_bytes,
                "noGRPCHeader": noGRPCHeader,
            }
            if uplinkHTTPMethod:
                extra["uplinkHTTPMethod"] = uplinkHTTPMethod
            if xPaddingKey:
                extra["xPaddingKey"] = xPaddingKey
            if xPaddingMethod:
                extra["xPaddingMethod"] = xPaddingMethod
            if xPaddingObfsMode:
                extra["xPaddingObfsMode"] = xPaddingObfsMode
            if xPaddingPlacement:
                extra["xPaddingPlacement"] = xPaddingPlacement
            if scStreamUpServerSecs:
                extra["scStreamUpServerSecs"] = scStreamUpServerSecs
            if keepAlivePeriod > 0:
                extra["keepAlivePeriod"] = keepAlivePeriod
            if xmux:
                extra["xmux"] = xmux
            payload["extra"] = json.dumps(extra)

        elif net == 'kcp':
            payload['seed'] = path
            payload["host"] = host

        elif net == "ws":
            payload["path"] = path
            payload["host"] = host
            if heartbeatPeriod:
                payload["heartbeatPeriod"] = heartbeatPeriod

        else:
            payload["path"] = path
            payload["host"] = host

        if tls == "tls":
            payload["sni"] = sni
            payload["fp"] = fp
            if alpn:
                payload["alpn"] = alpn
            if fs:
                payload["fragment"] = fs
            if ais:
                payload["allowInsecure"] = 1

        elif tls == "reality":
            payload["sni"] = sni
            payload["fp"] = fp
            payload["pbk"] = pbk
            payload["sid"] = sid
            if spx:
                payload["spx"] = spx

        return (
            "vless://"
            + f"{id}@{address}:{port}?"
            + urlparse.urlencode(payload)
            + f"#{(urlparse.quote(remark))}"
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
               multiMode: bool = False,
               sc_max_each_post_bytes: int = 1000000,
               sc_max_concurrent_posts: int = 100,
               sc_min_posts_interval_ms: int = 30,
               x_padding_bytes: str = "100-1000",
               mode: str = "auto",
               noGRPCHeader: bool = False,
                         uplinkHTTPMethod: str = "",
                         xPaddingKey: str = "",
                         xPaddingMethod: str = "",
                         xPaddingObfsMode: bool = False,
                         xPaddingPlacement: str = "",
                         scStreamUpServerSecs: str = "",
               heartbeatPeriod: int = 0,
               keepAlivePeriod: int = 0,
               xmux: dict = {},
               ):

        payload = {
            "security": tls,
            "type": net,
            "headerType": type
        }
        if flow and (tls in ('tls', 'reality') and net in ('tcp', 'raw', 'kcp') and type != 'http'):
            payload['flow'] = flow

        if net == 'grpc':
            payload['serviceName'] = path
            payload["authority"] = host
            if multiMode:
                payload["mode"] = "multi"
            else:
                payload["mode"] = "gun"

        elif net in ("splithttp", "xhttp"):
            payload["path"] = path
            payload["host"] = host
            payload["mode"] = mode
            extra = {
                "scMaxEachPostBytes": sc_max_each_post_bytes,
                "scMaxConcurrentPosts": sc_max_concurrent_posts,
                "scMinPostsIntervalMs": sc_min_posts_interval_ms,
                "xPaddingBytes": x_padding_bytes,
                "noGRPCHeader": noGRPCHeader,
            }
            if uplinkHTTPMethod:
                extra["uplinkHTTPMethod"] = uplinkHTTPMethod
            if xPaddingKey:
                extra["xPaddingKey"] = xPaddingKey
            if xPaddingMethod:
                extra["xPaddingMethod"] = xPaddingMethod
            if xPaddingObfsMode:
                extra["xPaddingObfsMode"] = xPaddingObfsMode
            if xPaddingPlacement:
                extra["xPaddingPlacement"] = xPaddingPlacement
            if scStreamUpServerSecs:
                extra["scStreamUpServerSecs"] = scStreamUpServerSecs
            if keepAlivePeriod > 0:
                extra["keepAlivePeriod"] = keepAlivePeriod
            if xmux:
                extra["xmux"] = xmux
            payload["extra"] = json.dumps(extra)

        elif net == 'quic':
            payload['key'] = path
            payload["quicSecurity"] = host

        elif net == 'kcp':
            payload['seed'] = path
            payload["host"] = host

        elif net == "ws":
            payload["path"] = path
            payload["host"] = host
            if heartbeatPeriod:
                payload["heartbeatPeriod"] = heartbeatPeriod

        else:
            payload["path"] = path
            payload["host"] = host

        if tls == "tls":
            payload["sni"] = sni
            payload["fp"] = fp
            if alpn:
                payload["alpn"] = alpn
            if fs:
                payload["fragment"] = fs
            if ais:
                payload["allowInsecure"] = 1
        elif tls == "reality":
            payload["sni"] = sni
            payload["fp"] = fp
            payload["pbk"] = pbk
            payload["sid"] = sid
            if spx:
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


AUTO_BALANCER_TAG = "auto"

# Balancer strategies offered to the panel, with the settings each needs.
# leastLoad's numbers are the ones the reference config ships with: candidates
# whose RTT is within 1s are considered equal (tolerance 1%), two are kept.
AUTO_SELECT_STRATEGIES = {
    "leastLoad": {
        "type": "leastLoad",
        "settings": {
            "baselines": ["1s"],
            "expected": 2,
            "maxRTT": "1s",
            "tolerance": 0.01,
        },
    },
    "leastPing": {"type": "leastPing"},
    "roundRobin": {"type": "roundRobin"},
    "random": {"type": "random"},
}

DEFAULT_AUTO_SELECT = {
    "remark": "🌍 Автовыбор",
    "strategy": "leastLoad",
    "interval": "1m",
    "destination": "http://www.gstatic.com/generate_204",
}


class V2rayJsonConfig(str):

    def __new__(cls, *args, **kwargs):
        # the class subclasses str, whose __new__ would choke on our kwargs
        return super().__new__(cls)

    def __init__(self, routing_profile: str = None, auto_select: list = None):
        self.config = []
        self.template = render_template(V2RAY_SUBSCRIPTION_TEMPLATE)
        self.mux_template = render_template(MUX_TEMPLATE)
        user_agent_data = json.loads(render_template(USER_AGENT_TEMPLATE))

        if 'list' in user_agent_data and isinstance(user_agent_data['list'], list):
            self.user_agent_list = user_agent_data['list']
        else:
            self.user_agent_list = []

        grpc_user_agent_data = json.loads(render_template(GRPC_USER_AGENT_TEMPLATE))

        if 'list' in grpc_user_agent_data and isinstance(grpc_user_agent_data['list'], list):
            self.grpc_user_agent_data = grpc_user_agent_data['list']
        else:
            self.grpc_user_agent_data = []

        try:
            self.settings = json.loads(render_template(V2RAY_SETTINGS_TEMPLATE))
        except TemplateNotFound:
            self.settings = {}

        del user_agent_data, grpc_user_agent_data

        # Parsed once. add_config() shares these sub-objects between every
        # config instead of re-parsing the template per host: with the routing
        # profile on, the template is ~200 KB and a user can have dozens of
        # hosts, so re-parsing it each time is the difference between a few ms
        # and a few seconds per /sub request.
        self.base = json.loads(self.template)
        self.base.pop("remarks", None)
        self.base_outbounds = self.base.pop("outbounds", [])
        self.profile_outbounds = []
        self.routing_profile = routing_profile
        if routing_profile:
            self._apply_routing_profile(routing_profile)

        # auto-select: hosts assigned to a group in the panel are collected per
        # group and turned into one extra balanced config each by render().
        # auto_select is a list of group settings; index 0 is group 1.
        self.auto_select = list(auto_select or [])
        self.auto_outbounds = {}    # group -> member outbounds (+ their dialers)
        self.auto_member_tags = {}  # group -> member tags

    def _apply_routing_profile(self, name: str) -> None:
        """Overlays a shipped routing/DNS profile (split tunnel + ad blocking).

        Missing or broken profile files are ignored: a subscription without the
        overlay still works, one that fails to render does not.
        """
        try:
            profile = json.loads(render_template(f"v2ray/{name}.json"))
        except Exception:
            self.routing_profile = None
            return

        if profile.get("dns"):
            self.base["dns"] = profile["dns"]
        if profile.get("routing"):
            self.base["routing"] = profile["routing"]

        # rules pointing at "direct" need that outbound to exist; it goes last so
        # the proxy outbound stays first and remains Xray's default. Skip tags the
        # template already defines — a duplicate tag makes Xray reject the config.
        existing_tags = {o.get("tag") for o in self.base_outbounds}
        self.profile_outbounds = [
            o for o in (profile.get("outbounds") or [])
            if o.get("tag") not in existing_tags
        ]

        dest_override = profile.get("sniffing_dest_override")
        if dest_override:
            # domain rules can only match what sniffing exposes (QUIC included)
            for inbound in self.base.get("inbounds", []):
                sniffing = inbound.get("sniffing")
                if sniffing and sniffing.get("enabled"):
                    sniffing["destOverride"] = list(dest_override)

    def add_config(self, remarks, outbounds):
        config = dict(self.base)
        config["remarks"] = remarks
        config["outbounds"] = outbounds + self.base_outbounds + self.profile_outbounds
        self.config.append(config)

    def render(self, reverse=False):
        if reverse:
            self.config.reverse()
        # always on top, in group order, whichever way the host list is ordered
        for group in sorted(self.auto_member_tags, reverse=True):
            auto_config = self.build_auto_config(group)
            if auto_config:
                self.config.insert(0, auto_config)
        if self.routing_profile:
            # the profile repeats per config; indentation alone would add
            # megabytes to the response
            return json.dumps(self.config, separators=(",", ":"), cls=UUIDEncoder)
        return json.dumps(self.config, indent=4, cls=UUIDEncoder)

    @staticmethod
    def tls_config(sni=None, fp=None, alpn=None, ais: bool = False) -> dict:

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
    def reality_config(sni=None, fp=None, pbk=None, sid=None, spx=None) -> dict:

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
        if spx:
            realitySettings["spiderX"] = spx

        return realitySettings

    def ws_config(self, path: str = "", host: str = "", random_user_agent: bool = False, heartbeatPeriod: int = 0) -> dict:
        wsSettings = copy.deepcopy(self.settings.get("wsSettings", {}))

        if "headers" not in wsSettings:
            wsSettings["headers"] = {}
        if path:
            wsSettings["path"] = path
        if host:
            wsSettings["host"] = host
        if random_user_agent:
            wsSettings["headers"]["User-Agent"] = choice(self.user_agent_list)
        if heartbeatPeriod:
            wsSettings["heartbeatPeriod"] = heartbeatPeriod

        return wsSettings

    def httpupgrade_config(self, path: str = "", host: str = "", random_user_agent: bool = False) -> dict:
        httpupgradeSettings = copy.deepcopy(self.settings.get("httpupgradeSettings", {}))

        if "headers" not in httpupgradeSettings:
            httpupgradeSettings["headers"] = {}
        if path:
            httpupgradeSettings["path"] = path
        if host:
            httpupgradeSettings["host"] = host
        if random_user_agent:
            httpupgradeSettings["headers"]["User-Agent"] = choice(
                self.user_agent_list)

        return httpupgradeSettings

    def splithttp_config(self, path: str = "", host: str = "", random_user_agent: bool = False,
                         sc_max_each_post_bytes: int = 1000000,
                         sc_max_concurrent_posts: int = 100,
                         sc_min_posts_interval_ms: int = 30,
                         x_padding_bytes: str = "100-1000",
                         xmux: dict = {},
                         mode: str = "auto",
                         noGRPCHeader: bool = False,
                         uplinkHTTPMethod: str = "",
                         xPaddingKey: str = "",
                         xPaddingMethod: str = "",
                         xPaddingObfsMode: bool = False,
                         xPaddingPlacement: str = "",
                         scStreamUpServerSecs: str = "",
                         keepAlivePeriod: int = 0,
                         ) -> dict:
        config = copy.deepcopy(self.settings.get("splithttpSettings", {}))

        config["mode"] = mode
        if path:
            config["path"] = path
        if host:
            config["host"] = host
        if random_user_agent:
            config["headers"]["User-Agent"] = choice(
                self.user_agent_list)
        config.setdefault("scMaxEachPostBytes", sc_max_each_post_bytes)
        config.setdefault("scMaxConcurrentPosts", sc_max_concurrent_posts)
        config.setdefault("scMinPostsIntervalMs", sc_min_posts_interval_ms)
        config.setdefault("xPaddingBytes", x_padding_bytes)
        config["noGRPCHeader"] = noGRPCHeader
        if xmux:
            config["xmux"] = xmux
        if keepAlivePeriod > 0:
            config["keepAlivePeriod"] = keepAlivePeriod
        if uplinkHTTPMethod:
            config["uplinkHTTPMethod"] = uplinkHTTPMethod
        if xPaddingKey:
            config["xPaddingKey"] = xPaddingKey
        if xPaddingMethod:
            config["xPaddingMethod"] = xPaddingMethod
        if xPaddingObfsMode:
            config["xPaddingObfsMode"] = xPaddingObfsMode
        if xPaddingPlacement:
            config["xPaddingPlacement"] = xPaddingPlacement
        if scStreamUpServerSecs:
            config["scStreamUpServerSecs"] = scStreamUpServerSecs

        return config

    def grpc_config(self, path: str = "", host: str = "", multiMode: bool = False,
                    random_user_agent: bool = False) -> dict:
        config = copy.deepcopy(self.settings.get("grpcSettings", {
            "idle_timeout": 60,
            "health_check_timeout": 20,
            "permit_without_stream": False,
            "initial_windows_size": 35538
        }))

        config["multiMode"] = multiMode

        if path:
            config["serviceName"] = path
        if host:
            config["authority"] = host

        if random_user_agent:
            config["user_agent"] = choice(self.grpc_user_agent_data)

        return config

    def tcp_config(self, headers="none", path: str = "", host: str = "", random_user_agent: bool = False) -> dict:
        if headers == "http":
            config = copy.deepcopy(self.settings.get("tcphttpSettings", {
                "header": {
                    "request": {
                        "headers": {
                            "Accept-Encoding": [
                                "gzip", "deflate"
                            ],
                            "Connection": [
                                "keep-alive"
                            ],
                            "Pragma": "no-cache"
                        },
                        "method": "GET",
                        "version": "1.1"
                    }
                }
            }))
        else:
            config = copy.deepcopy(self.settings.get("tcpSettings", self.settings.get("rawSettings", {
                "header": {
                    "type": "none"
                }
            })))
        if "header" not in config:
            config["header"] = {}

        if headers:
            config["header"]["type"] = headers

        if any((path, host, random_user_agent)):
            if "request" not in config["header"]:
                config["header"]["request"] = {}

        if any((random_user_agent, host)):
            if "headers" not in config["header"]["request"]:
                config["header"]["request"]["headers"] = {}

        if path:
            config["header"]["request"]["path"] = [path]

        if host:
            config["header"]["request"]["headers"]["Host"] = [host]

        if random_user_agent:
            config["header"]["request"]["headers"]["User-Agent"] = [
                choice(self.user_agent_list)]

        return config

    def http_config(self, net="http", path: str = "", host: str = "", random_user_agent: bool = False) -> dict:
        if net == "h2":
            config = copy.deepcopy(self.settings.get("h2Settings", {
                "header": {}
            }))
        elif net == "h3":
            config = copy.deepcopy(self.settings.get("h3Settings", {
                "header": {}
            }))
        else:
            config = self.settings.get("httpSettings", {
                "header": {}
            })
        if "header" not in config:
            config["header"] = {}

        config["path"] = path
        if host:
            config["host"] = [host]
        else:
            config["host"] = []
        if random_user_agent:
            config["headers"]["User-Agent"] = [
                choice(self.user_agent_list)]

        return config

    def quic_config(self, path=None, host=None, header=None) -> dict:
        quicSettings = copy.deepcopy(self.settings.get("quicSettings", {
            "security": "none",
            "header": {
                "type": "none"
            },
            "key": ""
        }))
        if "header" not in quicSettings:
            quicSettings["header"] = {"type": "none"}

        if path:
            quicSettings["key"] = path
        if host:
            quicSettings["security"] = host
        if header:
            quicSettings["header"]["type"] = header

        return quicSettings

    def kcp_config(self, seed=None, host=None, header=None) -> dict:
        kcpSettings = copy.deepcopy(self.settings.get("kcpSettings", {
            "header": {
                "type": "none"
            },
            "mtu": 1350,
            "tti": 50,
            "uplinkCapacity": 12,
            "downlinkCapacity": 100,
            "congestion": False,
            "readBufferSize": 2,
            "writeBufferSize": 2,
        }))
        if "header" not in kcpSettings:
            kcpSettings["header"] = {"type": "none"}

        if seed:
            kcpSettings["seed"] = seed
        if header:
            kcpSettings["header"]["type"] = header
        if host:
            kcpSettings["header"]["domain"] = host

        return kcpSettings

    @staticmethod
    def stream_setting_config(network=None, security=None,
                              network_setting=None, tls_settings=None,
                              sockopt=None) -> dict:

        streamSettings = {"network": network}

        if security and security != "none":
            streamSettings["security"] = security
            streamSettings[f"{security}Settings"] = tls_settings

        if network and network_setting:
            streamSettings[f"{network}Settings"] = network_setting

        if sockopt:
            streamSettings['sockopt'] = sockopt

        return streamSettings

    @staticmethod
    def vmess_config(address=None, port=None, id=None) -> dict:
        return {
            "vnext": [
                {
                    "address": address,
                    "port": port,
                    "users": [
                        {
                            "id": id,
                            "alterId": 0,
                            "email": "https://gozargah.github.io/marzban/",
                            "security": "auto"
                        }
                    ],
                }
            ]
        }

    @staticmethod
    def vless_config(address=None, port=None, id=None, flow="") -> dict:
        return {
            "vnext": [
                {
                    "address": address,
                    "port": port,
                    "users": [
                        {
                            "id": id,
                            "security": "auto",
                            "encryption": "none",
                            "email": "https://gozargah.github.io/marzban/",
                            "alterId": 0,
                            "flow": flow
                        }
                    ],
                }
            ]
        }

    @staticmethod
    def trojan_config(address=None, port=None, password=None) -> dict:
        return {
            "servers": [
                {
                    "address": address,
                    "port": port,
                    "password": password,
                    "email": "https://gozargah.github.io/marzban/",
                }
            ]
        }

    @staticmethod
    def shadowsocks_config(address=None, port=None, password=None, method=None) -> dict:
        return {
            "servers": [
                {
                    "address": address,
                    "port": port,
                    "password": password,
                    "email": "https://gozargah.github.io/marzban/",
                    "method": method,
                    "uot": False,
                }
            ]
        }

    @staticmethod
    def make_fragment(fragment: str) -> dict:
        length, interval, packets = fragment.split(',')
        return {
            "packets": packets,
            "length": length,
            "interval": interval
        }

    @staticmethod
    def make_noises(noises: str) -> list:
        sn = noises.split("&")
        noises_settings = []
        for n in sn:
            try:
                tp, delay = n.split(',')
                _type, packet = tp.split(":")
                noises_settings.append({
                    "type": _type,
                    "packet": packet,
                    "delay": delay
                })
            except ValueError:
                pass

        return noises_settings

    @staticmethod
    def make_dialer_outbound(fragment: str = "", noises: str = "") -> Union[dict, None]:
        dialer_settings = {}
        if fragment:
            dialer_settings["fragment"] = V2rayJsonConfig.make_fragment(fragment)
        if noises:
            dialer_settings["noises"] = V2rayJsonConfig.make_noises(noises)

        if dialer_settings:
            return {
                "tag": "dialer",
                "protocol": "freedom",
                "settings": dialer_settings
            }

        return None

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
                            spx='',
                            headers='',
                            ais='',
                            dialer_proxy='',
                            multiMode: bool = False,
                            random_user_agent: bool = False,
                            sc_max_each_post_bytes: int = 1000000,
                            sc_max_concurrent_posts: int = 100,
                            sc_min_posts_interval_ms: int = 30,
                            x_padding_bytes: str = "100-1000",
                            xmux: dict = {},
                            mode: str = "auto",
                            noGRPCHeader: bool = False,
                         uplinkHTTPMethod: str = "",
                         xPaddingKey: str = "",
                         xPaddingMethod: str = "",
                         xPaddingObfsMode: bool = False,
                         xPaddingPlacement: str = "",
                         scStreamUpServerSecs: str = "",
                            heartbeatPeriod: int = 0,
                            keepAlivePeriod: int = 0,
                            ) -> dict:

        if net == "ws":
            network_setting = self.ws_config(
                path=path, host=host, random_user_agent=random_user_agent, heartbeatPeriod=heartbeatPeriod)
        elif net == "grpc":
            network_setting = self.grpc_config(
                path=path, host=host, multiMode=multiMode, random_user_agent=random_user_agent)
        elif net in ("h3", "h2", "http"):
            network_setting = self.http_config(
                net=net, path=path, host=host, random_user_agent=random_user_agent)
        elif net == "kcp":
            network_setting = self.kcp_config(
                seed=path, host=host, header=headers)
        elif net in ("tcp", "raw") and tls != "reality":
            network_setting = self.tcp_config(
                headers=headers, path=path, host=host, random_user_agent=random_user_agent)
        elif net == "quic":
            network_setting = self.quic_config(
                path=path, host=host, header=headers)
        elif net == "httpupgrade":
            network_setting = self.httpupgrade_config(
                path=path, host=host, random_user_agent=random_user_agent)
        elif net in ("splithttp", "xhttp"):
            network_setting = self.splithttp_config(path=path, host=host, random_user_agent=random_user_agent,
                                                    sc_max_each_post_bytes=sc_max_each_post_bytes,
                                                    sc_max_concurrent_posts=sc_max_concurrent_posts,
                                                    sc_min_posts_interval_ms=sc_min_posts_interval_ms,
                                                    x_padding_bytes=x_padding_bytes,
                                                    xmux=xmux,
                                                    mode=mode,
                                                    noGRPCHeader=noGRPCHeader,
                                                    keepAlivePeriod=keepAlivePeriod,
                                                    uplinkHTTPMethod=uplinkHTTPMethod,
                                                    xPaddingKey=xPaddingKey,
                                                    xPaddingMethod=xPaddingMethod,
                                                    xPaddingObfsMode=xPaddingObfsMode,
                                                    xPaddingPlacement=xPaddingPlacement,
                                                    scStreamUpServerSecs=scStreamUpServerSecs,
                                                    )
        else:
            network_setting = {}

        if tls == "tls":
            tls_settings = self.tls_config(sni=sni, fp=fp, alpn=alpn, ais=ais)
        elif tls == "reality":
            tls_settings = self.reality_config(
                sni=sni, fp=fp, pbk=pbk, sid=sid, spx=spx)
        else:
            tls_settings = None

        if dialer_proxy:
            sockopt = {
                "dialerProxy": dialer_proxy
            }
        else:
            sockopt = None

        return self.stream_setting_config(network=net, security=tls,
                                          network_setting=network_setting,
                                          tls_settings=tls_settings,
                                          sockopt=sockopt)

    def make_outbounds(self, address: str, inbound: dict, settings: dict,
                       tag: str = "proxy") -> list:
        """Builds the proxy outbound for one host (plus its dialer, if any).

        `tag` lets the auto-select balancer emit the same host under proxy-2,
        proxy-3, ... in a single config; the dialer tag follows it so two
        members with fragment/noise settings can't collide.
        """

        net = inbound['network']
        protocol = inbound['protocol']
        port = inbound['port']
        if isinstance(port, str):
            ports = port.split(',')
            port = int(choice(ports))

        tls = (inbound['tls'])
        headers = inbound['header_type']
        fragment = inbound['fragment_setting']
        noise = inbound['noise_setting']
        path = inbound["path"]
        multi_mode = inbound.get("multiMode", False)

        if net in ["grpc", "gun"]:
            if multi_mode:
                path = get_grpc_multi(path)
            else:
                path = get_grpc_gun(path)

        outbound = {
            "tag": tag,
            "protocol": protocol
        }

        if inbound['protocol'] == 'vmess':
            outbound["settings"] = self.vmess_config(address=address,
                                                     port=port,
                                                     id=settings['id'])

        elif inbound['protocol'] == 'vless':
            if net in ('tcp', 'raw', 'kcp') and headers != 'http' and tls in ('tls', 'reality'):
                flow = settings.get('flow', '')
            else:
                flow = None

            outbound["settings"] = self.vless_config(address=address,
                                                     port=port,
                                                     id=settings['id'],
                                                     flow=flow)

        elif inbound['protocol'] == 'trojan':
            outbound["settings"] = self.trojan_config(address=address,
                                                      port=port,
                                                      password=settings['password'])

        elif inbound['protocol'] == 'shadowsocks':
            outbound["settings"] = self.shadowsocks_config(address=address,
                                                           port=port,
                                                           password=settings['password'],
                                                           method=settings['method'])

        outbounds = [outbound]
        dialer_proxy = ''
        extra_outbound = self.make_dialer_outbound(fragment, noise)
        if extra_outbound:
            if tag != "proxy":
                extra_outbound["tag"] = f"dialer-{tag}"
            dialer_proxy = extra_outbound['tag']
            outbounds.append(extra_outbound)

        alpn = inbound.get('alpn', None)
        outbound["streamSettings"] = self.make_stream_setting(
            net=net,
            tls=tls,
            sni=inbound['sni'],
            host=inbound['host'],
            path=path,
            alpn=alpn.rsplit(sep=",") if alpn else None,
            fp=inbound.get('fp', ''),
            pbk=inbound.get('pbk', ''),
            sid=inbound.get('sid', ''),
            spx=inbound.get('spx', ''),
            headers=headers,
            ais=inbound.get('ais', ''),
            dialer_proxy=dialer_proxy,
            multiMode=multi_mode,
            random_user_agent=inbound.get('random_user_agent', False),
            sc_max_each_post_bytes=inbound.get('scMaxEachPostBytes', 1000000),
            sc_max_concurrent_posts=inbound.get('scMaxConcurrentPosts', 100),
            sc_min_posts_interval_ms=inbound.get('scMinPostsIntervalMs', 30),
            x_padding_bytes=inbound.get("xPaddingBytes", "100-1000"),
            xmux=inbound.get("xmux", {}),
            mode=inbound.get("mode", "auto"),
            noGRPCHeader=inbound.get("noGRPCHeader", False),
            uplinkHTTPMethod=inbound.get("uplinkHTTPMethod", ""),
            xPaddingKey=inbound.get("xPaddingKey", ""),
            xPaddingMethod=inbound.get("xPaddingMethod", ""),
            xPaddingObfsMode=inbound.get("xPaddingObfsMode", False),
            xPaddingPlacement=inbound.get("xPaddingPlacement", ""),
            scStreamUpServerSecs=inbound.get("scStreamUpServerSecs", ""),
            heartbeatPeriod=inbound.get("heartbeatPeriod", 0),
            keepAlivePeriod=inbound.get("keepAlivePeriod", 0),
        )

        mux_json = json.loads(self.mux_template)
        mux_config = mux_json["v2ray"]

        if inbound.get('mux_enable', False):
            outbound["mux"] = mux_config
            outbound["mux"]["enabled"] = True

        return outbounds

    def add(self, remark: str, address: str, inbound: dict, settings: dict):
        self.add_config(
            remarks=remark,
            outbounds=self.make_outbounds(address, inbound, settings),
        )

    def add_auto_member(self, address: str, inbound: dict, settings: dict,
                        group: int = 1) -> None:
        """Registers a host as a candidate of one auto-select group.

        The host keeps its own entry in the subscription; this only adds it to
        the extra balanced config built by build_auto_config(). Groups are
        independent: a host belongs to at most one.
        """
        if not group or group < 1:
            return
        tags = self.auto_member_tags.setdefault(group, [])
        n = len(tags) + 1
        tag = "proxy" if n == 1 else f"proxy-{n}"
        try:
            outbounds = self.make_outbounds(address, inbound, settings, tag=tag)
        except Exception:
            # a member that can't be rendered must not cost the user the whole
            # subscription — it simply doesn't join the balancer
            return
        tags.append(tag)
        self.auto_outbounds.setdefault(group, []).extend(outbounds)

    def group_settings(self, group: int) -> dict:
        """Settings of one auto-select group, over the shipped defaults.

        Groups the panel never configured still work: they fall back to the
        defaults, with the group number appended to the remark so two entries
        can't end up with the same name.
        """
        values = dict(DEFAULT_AUTO_SELECT)
        stored = {}
        index = group - 1
        if 0 <= index < len(self.auto_select):
            stored = self.auto_select[index] or {}
        for key in values:
            value = stored.get(key)
            if value not in (None, ""):
                values[key] = value
        if group > 1 and not stored.get("remark"):
            values["remark"] = f'{DEFAULT_AUTO_SELECT["remark"]} {group}'
        return values

    def _observatory_config(self, strategy: str, settings: dict) -> dict:
        """Probe block feeding the balancer's health data.

        leastLoad reads burstObservatory (per-request RTT distribution),
        leastPing reads the plain observatory. roundRobin/random need neither.
        """
        interval = settings.get("interval") or DEFAULT_AUTO_SELECT["interval"]
        destination = settings.get("destination") or DEFAULT_AUTO_SELECT["destination"]

        if strategy == "leastLoad":
            return {
                "burstObservatory": {
                    "subjectSelector": ["proxy"],
                    "pingConfig": {
                        "destination": destination,
                        "connectivity": "",
                        "interval": interval,
                        "timeout": "3s",
                        "sampling": 1,
                    },
                }
            }
        if strategy == "leastPing":
            return {
                "observatory": {
                    "subjectSelector": ["proxy"],
                    "probeURL": destination,
                    "probeInterval": interval,
                    "enableConcurrency": True,
                }
            }
        return {}

    def build_auto_config(self, group: int) -> Union[dict, None]:
        """One extra config whose outbounds are picked by an Xray balancer.

        Returns None when fewer than two hosts joined the group — a balancer
        over a single server is just that server under a second name.
        """
        if len(self.auto_member_tags.get(group) or []) < 2:
            return None

        settings = self.group_settings(group)
        strategy = settings.get("strategy") or DEFAULT_AUTO_SELECT["strategy"]
        if strategy not in AUTO_SELECT_STRATEGIES:
            strategy = DEFAULT_AUTO_SELECT["strategy"]

        config = dict(self.base)
        config["remarks"] = settings["remark"]

        routing = copy.deepcopy(self.base.get("routing") or {})
        rules = routing.get("rules") or []
        # whatever the routing profile sent through "proxy" now goes through the
        # balancer; its direct/block rules are left alone
        for rule in rules:
            if rule.get("outboundTag") == "proxy":
                rule.pop("outboundTag")
                rule["balancerTag"] = AUTO_BALANCER_TAG
        if not any(r.get("balancerTag") == AUTO_BALANCER_TAG for r in rules):
            # no profile: keep torrents off the exits, send the rest to the balancer
            rules.append({"type": "field", "protocol": ["bittorrent"], "outboundTag": "direct"})
            rules.append({"type": "field", "network": "tcp,udp", "balancerTag": AUTO_BALANCER_TAG})
        routing["rules"] = rules
        routing["balancers"] = [{
            "tag": AUTO_BALANCER_TAG,
            "selector": ["proxy"],
            "fallbackTag": "direct",
            "strategy": AUTO_SELECT_STRATEGIES[strategy],
        }]
        config["routing"] = routing
        config.update(self._observatory_config(strategy, settings))

        outbounds = (list(self.auto_outbounds.get(group) or [])
                     + self.base_outbounds + self.profile_outbounds)
        tags = {o.get("tag") for o in outbounds}
        # fallbackTag and the bittorrent rule point at "direct"; a rule aimed at
        # a tag that doesn't exist silently falls through to the first outbound
        if "direct" not in tags:
            outbounds.append({"protocol": "freedom", "tag": "direct"})
        if "block" not in tags and any(r.get("outboundTag") == "block" for r in rules):
            outbounds.append({"protocol": "blackhole", "tag": "block"})
        config["outbounds"] = outbounds

        return config

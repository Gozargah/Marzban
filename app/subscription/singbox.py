import json
from random import choice

from app.subscription.funcs import detect_shadowsocks_2022, get_grpc_gun
from app.templates import render_template
from app.utils.helpers import UUIDEncoder
from config import SINGBOX_SUBSCRIPTION_TEMPLATE

from . import BaseSubscription


class SingBoxConfiguration(BaseSubscription):
    def __init__(self):
        super().__init__()
        self.config = json.loads(render_template(SINGBOX_SUBSCRIPTION_TEMPLATE))

    def add_outbound(self, outbound_data):
        self.config["outbounds"].append(outbound_data)

    def render(self, reverse=False):
        urltest_types = ["vmess", "vless", "trojan", "shadowsocks", "hysteria2", "tuic", "http", "ssh"]
        urltest_tags = [outbound["tag"] for outbound in self.config["outbounds"] if outbound["type"] in urltest_types]
        selector_types = ["vmess", "vless", "trojan", "shadowsocks", "hysteria2", "tuic", "http", "ssh", "urltest"]
        selector_tags = [outbound["tag"] for outbound in self.config["outbounds"] if outbound["type"] in selector_types]

        for outbound in self.config["outbounds"]:
            if outbound.get("type") == "urltest":
                outbound["outbounds"] = urltest_tags

        for outbound in self.config["outbounds"]:
            if outbound.get("type") == "selector":
                outbound["outbounds"] = selector_tags

        if reverse:
            self.config["outbounds"].reverse()
        return json.dumps(self.config, indent=4, cls=UUIDEncoder)

    def tls_config(self, sni=None, fp=None, tls=None, pbk=None, sid=None, alpn=None, ais=None, fragment=None):
        config = {
            "enabled": tls in ("tls", "reality"),
            "server_name": sni,
            "insecure": ais,
            "utls": {"enabled": bool(fp), "fingerprint": fp} if fp else None,
            "alpn": ([alpn] if not isinstance(alpn, list) else alpn) if alpn else None,
            "reality": {
                "enabled": tls == "reality",
                "public_key": pbk,
                "short_id": sid,
            }
            if tls == "reality"
            else None,
        }
        if fragment and (singbox_fragment := fragment.get("sing_box")):
            config.update(singbox_fragment)

        return self._remove_none_values(config)

    def http_config(
        self,
        host="",
        path="",
        random_user_agent: bool = False,
        request: dict | None = None,
        http_headers: dict | None = None,
        headers="none",
    ):
        config = {
            "idle_timeout": "15s",
            "ping_timeout": "15s",
            "path": path,
        }

        if headers == "http" and request:
            config.update(request)
        else:
            config["headers"] = {k: [v] for k, v in http_headers.items()} if http_headers else {}
        config["host"] = [host] if host else None
        if random_user_agent:
            config["headers"]["User-Agent"] = choice(self.user_agent_list)

        return self._remove_none_values(config)

    def ws_config(
        self,
        host="",
        path="",
        random_user_agent: bool = False,
        max_early_data=None,
        early_data_header_name=None,
        http_headers: dict | None = None,
    ):
        config = {
            "headers": {k: [v] for k, v in http_headers.items()} if http_headers else {},
            "path": path,
            "max_early_data": max_early_data,
            "early_data_header_name": early_data_header_name,
        }
        config["headers"]["host"] = [host] if host else None
        if random_user_agent:
            config["headers"]["User-Agent"] = [choice(self.user_agent_list)]

        return self._remove_none_values(config)

    def grpc_config(self, path="", idle_timeout: str = "", ping_timeout: str = "", permit_without_stream: bool = False):
        config = {
            "service_name": path,
            "idle_timeout": f"{idle_timeout}s" if idle_timeout else "15s",
            "ping_timeout": f"{ping_timeout}s" if ping_timeout else "15s",
            "permit_without_stream": permit_without_stream,
        }
        return self._remove_none_values(config)

    def httpupgrade_config(self, host="", path="", random_user_agent: bool = False, http_headers: dict | None = None):
        config = {
            "headers": {k: [v] for k, v in http_headers.items()} if http_headers else {},
            "host": host,
            "path": path,
        }
        if random_user_agent:
            config["headers"]["User-Agent"] = choice(self.user_agent_list)
        return self._remove_none_values(config)

    def transport_config(
        self,
        transport_type="",
        host="",
        path="",
        ping_timeout="",
        idle_timeout="",
        max_early_data=None,
        early_data_header_name=None,
        random_user_agent: bool = False,
        http_headers: dict | None = None,
        permit_without_stream: bool = False,
        request: dict | None = None,
        headers="none",
    ):
        transport_config = {}

        if transport_type:
            if transport_type == "http":
                transport_config = self.http_config(
                    host=host,
                    path=path,
                    random_user_agent=random_user_agent,
                    request=request,
                    http_headers=http_headers,
                    headers=headers,
                )

            elif transport_type == "ws":
                transport_config = self.ws_config(
                    host=host,
                    path=path,
                    random_user_agent=random_user_agent,
                    max_early_data=max_early_data,
                    early_data_header_name=early_data_header_name,
                    http_headers=http_headers,
                )

            elif transport_type == "grpc":
                transport_config = self.grpc_config(
                    path=path,
                    idle_timeout=idle_timeout,
                    ping_timeout=ping_timeout,
                    permit_without_stream=permit_without_stream,
                )

            elif transport_type == "httpupgrade":
                transport_config = self.httpupgrade_config(
                    host=host,
                    path=path,
                    random_user_agent=random_user_agent,
                    http_headers=http_headers,
                )

        transport_config["type"] = transport_type
        return transport_config

    def make_outbound(
        self,
        type: str,
        remark: str,
        address: str,
        port: int,
        net="",
        path="",
        host="",
        flow="",
        tls="",
        sni="",
        fp="",
        alpn="",
        pbk="",
        sid="",
        headers="",
        ais="",
        ping_timeout="",
        idle_timeout="",
        http_headers: dict | None = None,
        mux_settings: dict | None = None,
        request: dict | None = None,
        random_user_agent: bool = False,
        permit_without_stream: bool = False,
        fragment: dict | None = None,
    ):
        if isinstance(port, str):
            ports = port.split(",")
            port = int(choice(ports))

        config = {
            "type": type,
            "tag": remark,
            "server": address,
            "server_port": port,
        }

        if net in ("tcp", "raw", "kcp") and headers != "http" and (tls or tls != "none"):
            if flow:
                config["flow"] = flow

        if net == "h2":
            net = "http"
            alpn = "h2"
        elif net == "h3":
            net = "http"
            alpn = "h3"
        elif net in ("tcp", "raw") and headers == "http":
            net = "http"

        if net in ("http", "ws", "quic", "grpc", "httpupgrade"):
            max_early_data = None
            early_data_header_name = None

            if "?ed=" in path:
                path, max_early_data = path.split("?ed=")
                (max_early_data,) = max_early_data.split("/")
                max_early_data = int(max_early_data)
                early_data_header_name = "Sec-WebSocket-Protocol"

            config["transport"] = self.transport_config(
                transport_type=net,
                host=host,
                path=path,
                max_early_data=max_early_data,
                early_data_header_name=early_data_header_name,
                random_user_agent=random_user_agent,
                ping_timeout=ping_timeout,
                idle_timeout=idle_timeout,
                permit_without_stream=permit_without_stream,
                http_headers=http_headers,
                request=request,
                headers=headers,
            )

        if tls in ("tls", "reality"):
            config["tls"] = self.tls_config(
                sni=sni, fragment=fragment, fp=fp, tls=tls, pbk=pbk, sid=sid, alpn=alpn, ais=ais
            )

        if mux_settings and (singbox_mux := mux_settings.get("sing_box")):
            singbox_mux = self._remove_none_values(singbox_mux)
            config["multiplex"] = singbox_mux

        return config

    def add(self, remark: str, address: str, inbound: dict, settings: dict):
        net = inbound["network"]
        path = inbound["path"]

        # not supported by sing-box
        if net in ("kcp", "splithttp", "xhttp") or (net == "quic" and inbound["header_type"] != "none"):
            return

        if net in ("grpc", "gun"):
            path = get_grpc_gun(path)

        alpn = inbound.get("alpn", None)

        remark = self._remark_validation(remark)
        self.proxy_remarks.append(remark)

        outbound = self.make_outbound(
            remark=remark,
            type=inbound["protocol"],
            address=address,
            port=inbound["port"],
            net=net,
            tls=(inbound["tls"]),
            flow=settings.get("flow", ""),
            sni=inbound["sni"],
            host=inbound["host"],
            path=path,
            alpn=alpn.rsplit(sep=",") if alpn else None,
            fp=inbound.get("fp", ""),
            pbk=inbound.get("pbk", ""),
            sid=inbound.get("sid", ""),
            headers=inbound["header_type"],
            ais=inbound.get("ais", ""),
            random_user_agent=inbound.get("random_user_agent", False),
            idle_timeout=inbound.get("idle_timeout", ""),
            ping_timeout=inbound.get("health_check_timeout", ""),
            permit_without_stream=inbound.get("permit_without_stream", False),
            http_headers=inbound.get("http_headers"),
            request=inbound.get("request"),
            mux_settings=inbound.get("mux_settings", {}),
            fragment=inbound.get("fragment_settings", {}),
        )

        if inbound["protocol"] == "vmess":
            outbound["uuid"] = settings["id"]

        elif inbound["protocol"] == "vless":
            outbound["uuid"] = settings["id"]

        elif inbound["protocol"] == "trojan":
            outbound["password"] = settings["password"]

        elif inbound["protocol"] == "shadowsocks":
            outbound["method"], outbound["password"] = detect_shadowsocks_2022(
                inbound.get("is_2022", False),
                inbound.get("method", ""),
                settings["method"],
                inbound.get("password"),
                settings["password"],
            )

        self.add_outbound(outbound)

from random import choice
from uuid import UUID

import yaml

from app.subscription.funcs import detect_shadowsocks_2022, get_grpc_gun
from app.templates import render_template
from app.utils.helpers import yml_uuid_representer
from config import (
    CLASH_SUBSCRIPTION_TEMPLATE,
)

from . import BaseSubscription


class ClashConfiguration(BaseSubscription):
    def __init__(self):
        super().__init__()
        self.data = {
            "proxies": [],
            "proxy-groups": [],
            # Some clients rely on "rules" option and will fail without it.
            "rules": [],
        }

    def render(self, reverse=False):
        if reverse:
            self.data["proxies"].reverse()

        yaml.add_representer(UUID, yml_uuid_representer)
        return yaml.dump(
            yaml.load(
                render_template(CLASH_SUBSCRIPTION_TEMPLATE, {"conf": self.data, "proxy_remarks": self.proxy_remarks}),
                Loader=yaml.SafeLoader,
            ),
            sort_keys=False,
            allow_unicode=True,
        )

    def __str__(self) -> str:
        return self.render()

    def __repr__(self) -> str:
        return self.render()

    def http_config(
        self,
        path="",
        host="",
        random_user_agent: bool = False,
        request: dict | None = None,
    ):
        config = {
            "path": [path] if path else None,
            "Host": host,
        }
        if request:
            config.update(request)

        if random_user_agent:
            config["header"]["User-Agent"] = choice(self.user_agent_list)

        return self._remove_none_values(config)

    def ws_config(
        self,
        path="",
        host="",
        max_early_data=None,
        early_data_header_name="",
        is_httpupgrade: bool = False,
        random_user_agent: bool = False,
        http_headers: dict | None = None,
    ):
        config = {
            "path": path,
            "headers": {**http_headers, "Host": host} if http_headers else {"Host": host},
            "v2ray-http-upgrade": is_httpupgrade,
            "v2ray-http-upgrade-fast-open": is_httpupgrade,
            "max-early-data": max_early_data if max_early_data and not is_httpupgrade else None,
            "early-data-header-name": early_data_header_name if max_early_data and not is_httpupgrade else None,
        }
        if random_user_agent:
            config["headers"]["User-Agent"] = choice(self.user_agent_list)

        return self._remove_none_values(config)

    def grpc_config(self, path=""):
        config = {"grpc-service-name": path}
        return self._remove_none_values(config)

    def h2_config(self, path="", host=""):
        config = {
            "path": path,
            "host": [host] if host else None,
        }
        return self._remove_none_values(config)

    def tcp_config(
        self,
        path="",
        host="",
        http_headers: dict | None = None,
    ):
        config = {
            "path": [path] if path else None,
            "headers": {**http_headers, "Host": host} if http_headers else {"Host": host},
        }
        return self._remove_none_values(config)

    def make_node(
        self,
        remark: str,
        type: str,
        server: str,
        port: int,
        network: str,
        tls: bool,
        sni: str,
        host: str,
        path: str,
        headers: str = "",
        udp: bool = True,
        alpn: str = "",
        ais: bool = "",
        random_user_agent: bool = False,
        http_headers: dict | None = None,
        mux_settings: dict | None = None,
        request: dict | None = None,
    ):
        if network in ["grpc", "gun"]:
            path = get_grpc_gun(path)

        if type == "shadowsocks":
            type = "ss"
        if network in ("http", "h2", "h3"):
            network = "h2"
        if network in ("tcp", "raw") and headers == "http":
            network = "http"
        if network == "httpupgrade":
            network = "ws"
            is_httpupgrade = True
        else:
            is_httpupgrade = False
        node = {"name": remark, "type": type, "server": server, "port": port, "network": network, "udp": udp}

        if "?ed=" in path:
            path, max_early_data = path.split("?ed=")
            (max_early_data,) = max_early_data.split("/")
            max_early_data = int(max_early_data)
            early_data_header_name = "Sec-WebSocket-Protocol"
        else:
            max_early_data = None
            early_data_header_name = ""

        if type == "ss":  # shadowsocks
            return node

        if tls:
            node["tls"] = True
            if type == "trojan":
                node["sni"] = sni
            else:
                node["servername"] = sni
            if alpn:
                node["alpn"] = alpn.split(",")
            if ais:
                node["skip-cert-verify"] = ais

        if network == "http":
            net_opts = self.http_config(
                path=path,
                host=host,
                random_user_agent=random_user_agent,
                request=request,
            )

        elif network == "ws":
            net_opts = self.ws_config(
                path=path,
                host=host,
                max_early_data=max_early_data,
                early_data_header_name=early_data_header_name,
                is_httpupgrade=is_httpupgrade,
                random_user_agent=random_user_agent,
                http_headers=http_headers,
            )

        elif network == "grpc" or network == "gun":
            net_opts = self.grpc_config(path=path)

        elif network == "h2":
            net_opts = self.h2_config(path=path, host=host)

        elif network in ("tcp", "raw"):
            net_opts = self.tcp_config(
                path=path,
                host=host,
            )

        else:
            net_opts = {}

        node[f"{network}-opts"] = net_opts

        if mux_settings and (clash_mux := mux_settings.get("clash")):
            clash_mux = {
                "enabled": clash_mux.get("enable"),
                "protocol": clash_mux.get("protocol"),
                "max-connections": clash_mux.get("max_connections"),
                "min-streams": clash_mux.get("min_streams"),
                "max-streams": clash_mux.get("max_streams"),
                "statistic": clash_mux.get("statistic"),
                "only-tcp": clash_mux.get("only_tcp"),
                "padding": clash_mux.get("padding"),
                "brutal-opts": {
                    "enabled": clash_mux.get("brutal", {}).get("enable"),
                    "up": clash_mux["brutal"]["up_mbps"],
                    "down": clash_mux["brutal"]["down_mbps"],
                }
                if clash_mux.get("brutal")
                else None,
            }
            node["smux"] = self._remove_none_values(clash_mux)

        return node

    def add(self, remark: str, address: str, inbound: dict, settings: dict):
        # not supported by clash
        if inbound["network"] in ("kcp", "splithttp", "xhttp"):
            return

        proxy_remark = self._remark_validation(remark)

        node = self.make_node(
            remark=proxy_remark,
            type=inbound["protocol"],
            server=address,
            port=inbound["port"],
            network=inbound["network"],
            tls=(inbound["tls"] == "tls"),
            sni=inbound["sni"],
            host=inbound["host"],
            path=inbound["path"],
            headers=inbound["header_type"],
            udp=True,
            alpn=inbound.get("alpn", ""),
            ais=inbound.get("ais", False),
            random_user_agent=inbound.get("random_user_agent"),
            http_headers=inbound.get("http_headers"),
            request=inbound.get("request"),
            mux_settings=inbound.get("mux_settings", {}),
        )

        if inbound["protocol"] == "vmess":
            node["uuid"] = settings["id"]
            node["alterId"] = 0
            node["cipher"] = "auto"

        elif inbound["protocol"] == "trojan":
            node["password"] = settings["password"]

        elif inbound["protocol"] == "shadowsocks":
            node["password"] = settings["password"]
            node["cipher"] = settings["method"]

        else:
            return

        self.data["proxies"].append(node)
        self.proxy_remarks.append(proxy_remark)


class ClashMetaConfiguration(ClashConfiguration):
    def make_node(
        self,
        remark: str,
        type: str,
        server: str,
        port: int,
        network: str,
        tls: bool,
        sni: str,
        host: str,
        path: str,
        headers: str = "",
        udp: bool = True,
        alpn: str = "",
        fp: str = "",
        pbk: str = "",
        sid: str = "",
        ais: bool = "",
        random_user_agent: bool = False,
        http_headers: dict | None = None,
        mux_settings: dict | None = None,
        request: dict | None = None,
    ):
        node = super().make_node(
            remark=remark,
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
            random_user_agent=random_user_agent,
            http_headers=http_headers,
            request=request,
            mux_settings=mux_settings,
        )
        if fp:
            node["client-fingerprint"] = fp
        if pbk:
            node["reality-opts"] = {"public-key": pbk, "short-id": sid}

        return node

    def add(self, remark: str, address: str, inbound: dict, settings: dict):
        # not supported by clash-meta
        if inbound["network"] in ("kcp", "splithttp", "xhttp") or (
            inbound["network"] == "quic" and inbound["header_type"] != "none"
        ):
            return

        proxy_remark = self._remark_validation(remark)

        node = self.make_node(
            remark=proxy_remark,
            type=inbound["protocol"],
            server=address,
            port=inbound["port"],
            network=inbound["network"],
            tls=(inbound["tls"] in ("tls", "reality")),
            sni=inbound["sni"],
            host=inbound["host"],
            path=inbound["path"],
            headers=inbound["header_type"],
            udp=True,
            alpn=inbound.get("alpn", ""),
            fp=inbound.get("fp", ""),
            pbk=inbound.get("pbk", ""),
            sid=inbound.get("sid", ""),
            ais=inbound.get("ais", False),
            random_user_agent=inbound.get("random_user_agent"),
            http_headers=inbound.get("http_headers"),
            request=inbound.get("request"),
            mux_settings=inbound.get("mux_settings", {}),
        )

        if inbound["protocol"] == "vmess":
            node["uuid"] = settings["id"]
            node["alterId"] = 0
            node["cipher"] = "auto"

        elif inbound["protocol"] == "vless":
            node["uuid"] = settings["id"]

            if (
                inbound["network"] in ("tcp", "raw", "kcp")
                and inbound["header_type"] != "http"
                and inbound["tls"] != "none"
            ):
                node["flow"] = settings.get("flow", "")

        elif inbound["protocol"] == "trojan":
            node["password"] = settings["password"]

        elif inbound["protocol"] == "shadowsocks":
            node["method"], node["cipher"] = detect_shadowsocks_2022(
                inbound.get("is_2022", False),
                inbound.get("method", ""),
                settings["method"],
                inbound.get("password"),
                settings["password"],
            )

        else:
            return

        self.data["proxies"].append(node)
        self.proxy_remarks.append(proxy_remark)

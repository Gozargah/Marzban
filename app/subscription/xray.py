import json
from random import choice
from typing import Union

from app.subscription.funcs import detect_shadowsocks_2022, get_grpc_gun, get_grpc_multi
from app.templates import render_template
from app.utils.helpers import UUIDEncoder
from config import V2RAY_SUBSCRIPTION_TEMPLATE

from . import BaseSubscription


class XrayConfig(BaseSubscription):
    def __init__(self):
        super().__init__()
        self.config = []
        self.template = render_template(V2RAY_SUBSCRIPTION_TEMPLATE)

    def add_config(self, remarks, outbounds):
        json_template = json.loads(self.template)
        json_template["remarks"] = remarks
        json_template["outbounds"] = outbounds + json_template["outbounds"]
        self.config.append(json_template)

    def render(self, reverse=False):
        if reverse:
            self.config.reverse()
        return json.dumps(self.config, indent=4, cls=UUIDEncoder)

    def tls_config(self, sni=None, fp=None, alpn=None, ais: bool = False) -> dict:
        tlsSettings = {
            "serverName": sni,
            "allowInsecure": ais if ais else False,
            "fingerprint": fp,
            "alpn": ([alpn] if not isinstance(alpn, list) else alpn) if fp else None,
            "show": False,
        }

        return self._remove_none_values(tlsSettings)

    def reality_config(self, sni=None, fp=None, pbk=None, sid=None, spx=None) -> dict:
        realitySettings = {
            "serverName": sni,
            "fingerprint": fp,
            "show": False,
            "publicKey": pbk,
            "shortId": sid,
            "spiderX": spx,
        }
        return self._remove_none_values(realitySettings)

    def ws_config(
        self,
        path: str = "",
        host: str = "",
        random_user_agent: bool = False,
        heartbeatPeriod: int | None = None,
        http_headers: dict | None = None,
    ) -> dict:
        wsSettings = {
            "headers": http_headers if http_headers is not None else {},
            "heartbeatPeriod": heartbeatPeriod,
            "path": path,
            "host": host,
        }
        if random_user_agent:
            wsSettings["headers"]["User-Agent"] = choice(self.user_agent_list)
        return self._remove_none_values(wsSettings)

    def httpupgrade_config(
        self, path: str = "", host: str = "", random_user_agent: bool = False, http_headers=None
    ) -> dict:
        httpupgradeSettings = {
            "headers": http_headers if http_headers is not None else {},
            "path": path,
            "host": host,
        }
        if random_user_agent:
            httpupgradeSettings["headers"]["User-Agent"] = choice(self.user_agent_list)

        return self._remove_none_values(httpupgradeSettings)

    def xhttp_config(
        self,
        path: str = "",
        host: str = "",
        random_user_agent: bool = False,
        sc_max_each_post_bytes: int | None = None,
        sc_max_concurrent_posts: int | None = None,
        sc_min_posts_interval_ms: int | None = None,
        x_padding_bytes: str | None = None,
        xmux: dict | None = None,
        downloadSettings: dict | None = None,
        mode: str = "",
        noGRPCHeader: bool | None = None,
        scStreamUpServerSecs: int | None = None,
        http_headers: dict | None = None,
    ) -> dict:
        xhttSettings = {}

        xhttSettings["mode"] = mode
        if path:
            xhttSettings["path"] = path
        if host:
            xhttSettings["host"] = host
        extra = {
            "headers": http_headers if http_headers is not None else {},
            "scMaxEachPostBytes": sc_max_each_post_bytes,
            "scMaxConcurrentPosts": sc_max_concurrent_posts,
            "scMinPostsIntervalMs": sc_min_posts_interval_ms,
            "xPaddingBytes": x_padding_bytes,
            "noGRPCHeader": noGRPCHeader,
            "scStreamUpServerSecs": scStreamUpServerSecs,
            "xmux": xmux,
            "downloadSettings": self.download_config(downloadSettings, True) if downloadSettings else None,
        }
        if random_user_agent:
            if mode in ("stream-one", "stream-up") and not noGRPCHeader:
                extra["headers"]["User-Agent"] = choice(self.grpc_user_agent_data)
            else:
                extra["headers"]["User-Agent"] = choice(self.user_agent_list)

        return self._remove_none_values(xhttSettings)

    def grpc_config(
        self,
        path: str = "",
        host: str = "",
        multiMode: bool = False,
        random_user_agent: bool = False,
        idle_timeout=None,
        health_check_timeout=None,
        permit_without_stream=False,
        initial_windows_size=None,
        http_headers=None,
    ) -> dict:
        grpcSettings = {
            "idle_timeout": idle_timeout if idle_timeout is not None else 60,
            "health_check_timeout": health_check_timeout if health_check_timeout is not None else 20,
            "permit_without_stream": permit_without_stream,
            "initial_windows_size": initial_windows_size if initial_windows_size is not None else 35538,
            "serviceName": path,
            "authority": host,
            "multiMode": multiMode,
        }
        if http_headers and "user-agent" in http_headers:
            grpcSettings["user_agent"] = http_headers["user-agent"]
        if random_user_agent:
            grpcSettings["user_agent"] = choice(self.grpc_user_agent_data)
        return self._remove_none_values(grpcSettings)

    def tcp_config(
        self,
        headers="none",
        path: str = "",
        host: str = "",
        random_user_agent: bool = False,
        request: dict | None = None,
        response: dict | None = None,
    ) -> dict:
        if headers == "http":
            tcpSettings = (
                {
                    "header": {
                        "type": headers,
                        "request": request
                        if request
                        else {
                            "version": "1.1",
                            "method": "GET",
                            "headers": {
                                "Accept-Encoding": ["gzip, deflate"],
                                "Connection": ["keep-alive"],
                                "Pragma": ["no-cache"],
                            },
                        },
                        "response": response
                        if response
                        else {
                            "version": "1.1",
                            "status": "200",
                            "reason": "OK",
                            "headers": {
                                "Content-Type": ["application/octet-stream", "video/mpeg"],
                                "Transfer-Encoding": ["chunked"],
                                "Connection": ["keep-alive"],
                                "Pragma": ["no-cache"],
                            },
                        },
                    }
                },
            )
        else:
            tcpSettings = {"header": {"type": headers}}

        if any((path, host, random_user_agent)):
            if "request" not in tcpSettings["header"]:
                tcpSettings["header"]["request"] = {}

        if any((random_user_agent, host)):
            if "headers" not in tcpSettings["header"]["request"]:
                tcpSettings["header"]["request"]["headers"] = {}

        if path:
            tcpSettings["header"]["request"]["path"] = [path]

        if host:
            tcpSettings["header"]["request"]["headers"]["Host"] = [host]

        if random_user_agent:
            tcpSettings["header"]["request"]["headers"]["User-Agent"] = [choice(self.user_agent_list)]

        return tcpSettings

    def http_config(
        self, path: str = "", host: str = "", random_user_agent: bool = False, http_headers: dict | None = None
    ) -> dict:
        httpSettings = {
            "headers": {k: [v] for k, v in http_headers.items()} if http_headers is not None else {},
            "path": path,
            "host": [host] if host else [],
        }
        if random_user_agent:
            httpSettings["headers"]["User-Agent"] = [choice(self.user_agent_list)]
        return self._remove_none_values(httpSettings)

    def quic_config(self, path=None, host=None, header="none") -> dict:
        quicSettings = {"security": host, "header": {"type": header}, "key": path}
        return self._remove_none_values(quicSettings)

    def kcp_config(
        self,
        seed=None,
        host=None,
        header="none",
        mtu=None,
        tti=None,
        uplinkCapacity=None,
        downlinkCapacity=None,
        congestion=False,
        readBufferSize=None,
        writeBufferSize=None,
    ) -> dict:
        kcpSettings = {
            "header": {"type": header, "domain": host},
            "mtu": mtu if mtu else 1350,
            "tti": tti if tti else 50,
            "uplinkCapacity": uplinkCapacity if uplinkCapacity else 12,
            "downlinkCapacity": downlinkCapacity if downlinkCapacity else 100,
            "congestion": congestion,
            "readBufferSize": readBufferSize if readBufferSize else 2,
            "writeBufferSize": writeBufferSize if writeBufferSize else 2,
            "seed": seed,
        }
        return self._remove_none_values(kcpSettings)

    @staticmethod
    def stream_setting_config(
        network=None, security=None, network_setting=None, tls_settings=None, sockopt=None
    ) -> dict:
        streamSettings = {"network": network}

        if security and security != "none":
            streamSettings["security"] = security
            streamSettings[f"{security}Settings"] = tls_settings

        if network and network_setting:
            streamSettings[f"{network}Settings"] = network_setting

        if sockopt:
            streamSettings["sockopt"] = sockopt

        return streamSettings

    def download_config(self, inbound: dict, link_format: bool = False) -> dict:
        net = inbound["network"]
        port = inbound["port"]
        if isinstance(port, str):
            ports = port.split(",")
            port = int(choice(ports))

        address = inbound["address"]
        tls = inbound["tls"]
        headers = inbound["header_type"]
        fragment = inbound["fragment_settings"]
        noise = inbound["noise_settings"]
        path = inbound["path"]
        multi_mode = inbound.get("multi_mode", False)

        if net in ("grpc", "gun"):
            if multi_mode:
                path = get_grpc_multi(path)
            else:
                path = get_grpc_gun(path)

        dialer_proxy = ""
        if (fragment or noise) and not link_format:
            dialer_proxy = "dsdialer"

        alpn = inbound.get("alpn", None)
        download_settings = self.make_stream_setting(
            net=net,
            tls=tls,
            sni=inbound["sni"],
            host=inbound["host"],
            path=path,
            alpn=alpn.rsplit(sep=",") if alpn else None,
            fp=inbound.get("fp", ""),
            pbk=inbound.get("pbk", ""),
            sid=inbound.get("sid", ""),
            spx=inbound.get("spx", ""),
            headers=headers,
            ais=inbound.get("ais", ""),
            multiMode=multi_mode,
            random_user_agent=inbound.get("random_user_agent", False),
            sc_max_each_post_bytes=inbound.get("sc_max_each_post_bytes"),
            sc_max_concurrent_posts=inbound.get("sc_max_concurrent_posts"),
            sc_min_posts_interval_ms=inbound.get("sc_min_posts_interval_ms"),
            x_padding_bytes=inbound.get("x_padding_bytes"),
            xmux=inbound.get("xmux", {}),
            downloadSettings=inbound.get("downloadSettings"),
            mode=inbound.get("mode", "auto"),
            noGRPCHeader=inbound.get("no_grpc_header"),
            heartbeatPeriod=inbound.get("heartbeat_period"),
            scStreamUpServerSecs=inbound.get("sc_stream_up_server_secs"),
            http_headers=inbound.get("http_headers"),
            request=inbound.get("request"),
            response=inbound.get("response"),
            mtu=inbound.get("mtu"),
            tti=inbound.get("tti"),
            uplinkCapacity=inbound.get("uplink_capacity"),
            downlinkCapacity=inbound.get("downlink_capacity"),
            congestion=inbound.get("congestion"),
            readBufferSize=inbound.get("read_buffer_size"),
            writeBufferSize=inbound.get("write_buffer_size"),
            idle_timeout=inbound.get("idle_timeout"),
            health_check_timeout=inbound.get("health_check_timeout"),
            permit_without_stream=inbound.get("permit_without_stream", False),
            initial_windows_size=inbound.get("initial_windows_size"),
            dialer_proxy=dialer_proxy,
        )

        return {
            "address": address,
            "port": port,
            **download_settings,
        }

    @staticmethod
    def vmess_config(address=None, port=None, id=None) -> dict:
        return {
            "vnext": [
                {
                    "address": address,
                    "port": port,
                    "users": [{"id": id, "alterId": 0, "email": "t@t.com", "security": "auto"}],
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
                            "email": "t@t.com",
                            "alterId": 0,
                            "flow": flow,
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
                    "email": "t@t.com",
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
                    "email": "t@t.com",
                    "method": method,
                    "uot": False,
                }
            ]
        }

    def make_dialer_outbound(
        self, fragment: dict | None = None, noises: dict | None = None, dialer_tag: str = "dialer"
    ) -> Union[dict, None]:
        dialer_settings = {
            "fragment": fragment.get("xray") if fragment else None,
            "noises": noises.get("xray") if noises else None,
        }
        dialer_settings = self._remove_none_values(dialer_settings)

        if dialer_settings:
            return {"tag": dialer_tag, "protocol": "freedom", "settings": dialer_settings}

    def make_stream_setting(
        self,
        net="",
        path="",
        host="",
        tls="",
        sni="",
        fp="",
        alpn="",
        pbk="",
        sid="",
        spx="",
        headers="",
        ais="",
        dialer_proxy="",
        multiMode: bool = False,
        random_user_agent: bool = False,
        sc_max_each_post_bytes: int | None = None,
        sc_max_concurrent_posts: int | None = None,
        sc_min_posts_interval_ms: int | None = None,
        x_padding_bytes: str | None = None,
        xmux: dict = {},
        downloadSettings: dict = {},
        mode: str = "",
        noGRPCHeader: bool | None = None,
        scStreamUpServerSecs: int | None = None,
        heartbeatPeriod: int = 0,
        http_headers: dict | None = None,
        idle_timeout=None,
        health_check_timeout=None,
        permit_without_stream=False,
        initial_windows_size=None,
        request: dict | None = None,
        response: dict | None = None,
        mtu=None,
        tti=None,
        uplinkCapacity=None,
        downlinkCapacity=None,
        congestion=False,
        readBufferSize=None,
        writeBufferSize=None,
    ) -> dict:
        if net == "ws":
            network_setting = self.ws_config(
                path=path,
                host=host,
                random_user_agent=random_user_agent,
                heartbeatPeriod=heartbeatPeriod,
                http_headers=http_headers,
            )
        elif net == "grpc":
            network_setting = self.grpc_config(
                path=path,
                host=host,
                multiMode=multiMode,
                random_user_agent=random_user_agent,
                idle_timeout=idle_timeout,
                health_check_timeout=health_check_timeout,
                permit_without_stream=permit_without_stream,
                initial_windows_size=initial_windows_size,
                http_headers=http_headers,
            )
        elif net in ("h3", "h2", "http"):
            network_setting = self.http_config(
                path=path, host=host, random_user_agent=random_user_agent, http_headers=http_headers
            )
        elif net == "kcp":
            network_setting = self.kcp_config(
                seed=path,
                host=host,
                header=headers,
                mtu=mtu,
                tti=tti,
                uplinkCapacity=uplinkCapacity,
                downlinkCapacity=downlinkCapacity,
                congestion=congestion,
                readBufferSize=readBufferSize,
                writeBufferSize=writeBufferSize,
            )
        elif net in ("tcp", "raw") and tls != "reality":
            network_setting = self.tcp_config(
                headers=headers,
                path=path,
                host=host,
                random_user_agent=random_user_agent,
                request=request,
                response=response,
            )
        elif net == "quic":
            network_setting = self.quic_config(path=path, host=host, header=headers)
        elif net == "httpupgrade":
            network_setting = self.httpupgrade_config(
                path=path, host=host, random_user_agent=random_user_agent, http_headers=http_headers
            )
        elif net in ("splithttp", "xhttp"):
            network_setting = self.xhttp_config(
                path=path,
                host=host,
                random_user_agent=random_user_agent,
                sc_max_each_post_bytes=sc_max_each_post_bytes,
                sc_max_concurrent_posts=sc_max_concurrent_posts,
                sc_min_posts_interval_ms=sc_min_posts_interval_ms,
                x_padding_bytes=x_padding_bytes,
                xmux=xmux,
                downloadSettings=downloadSettings,
                mode=mode,
                noGRPCHeader=noGRPCHeader,
                scStreamUpServerSecs=scStreamUpServerSecs,
                http_headers=http_headers,
            )
        else:
            network_setting = {}

        if tls == "tls":
            tls_settings = self.tls_config(sni=sni, fp=fp, alpn=alpn, ais=ais)
        elif tls == "reality":
            tls_settings = self.reality_config(sni=sni, fp=fp, pbk=pbk, sid=sid, spx=spx)
        else:
            tls_settings = None

        if dialer_proxy:
            sockopt = {"dialerProxy": dialer_proxy}
        else:
            sockopt = None

        return self.stream_setting_config(
            network=net, security=tls, network_setting=network_setting, tls_settings=tls_settings, sockopt=sockopt
        )

    def add(self, remark: str, address: str, inbound: dict, settings: dict):
        net = inbound["network"]
        protocol = inbound["protocol"]
        port = inbound["port"]
        if isinstance(port, str):
            ports = port.split(",")
            port = int(choice(ports))

        tls = inbound["tls"]
        headers = inbound["header_type"]
        fragment = inbound["fragment_settings"]
        noise = inbound["noise_settings"]
        path = inbound["path"]
        multi_mode = inbound.get("multi_mode", False)

        if net in ("grpc", "gun"):
            if multi_mode:
                path = get_grpc_multi(path)
            else:
                path = get_grpc_gun(path)

        outbound = {"tag": "proxy", "protocol": protocol}

        if inbound["protocol"] == "vmess":
            outbound["settings"] = self.vmess_config(address=address, port=port, id=settings["id"])

        elif inbound["protocol"] == "vless":
            if net in ("tcp", "raw", "kcp") and headers != "http" and tls in ("tls", "reality"):
                flow = settings.get("flow", "")
            else:
                flow = None

            outbound["settings"] = self.vless_config(address=address, port=port, id=settings["id"], flow=flow)

        elif inbound["protocol"] == "trojan":
            outbound["settings"] = self.trojan_config(address=address, port=port, password=settings["password"])

        elif inbound["protocol"] == "shadowsocks":
            method, password = detect_shadowsocks_2022(
                inbound.get("is_2022", False),
                inbound.get("method", ""),
                settings["method"],
                inbound.get("password"),
                settings["password"],
            )
            outbound["settings"] = self.shadowsocks_config(address=address, port=port, password=password, method=method)

        outbounds = [outbound]
        dialer_proxy = ""
        extra_outbound = self.make_dialer_outbound(fragment, noise)
        if extra_outbound:
            dialer_proxy = extra_outbound["tag"]
            outbounds.append(extra_outbound)

        if (ds := inbound.get("downloadSettings", {})) and (ds.get("fragment_settings") or ds.get("noise_settings")):
            ds_outbound = self.make_dialer_outbound(ds.get("fragment_settings"), ds.get("noise_settings"), "dsdialer")
            if ds_outbound:
                outbounds.append(ds_outbound)

        alpn = inbound.get("alpn", None)
        outbound["streamSettings"] = self.make_stream_setting(
            net=net,
            tls=tls,
            sni=inbound["sni"],
            host=inbound["host"],
            path=path,
            alpn=alpn.rsplit(sep=",") if alpn else None,
            fp=inbound.get("fp", ""),
            pbk=inbound.get("pbk", ""),
            sid=inbound.get("sid", ""),
            spx=inbound.get("spx", ""),
            headers=headers,
            ais=inbound.get("ais", ""),
            dialer_proxy=dialer_proxy,
            multiMode=multi_mode,
            random_user_agent=inbound.get("random_user_agent", False),
            sc_max_each_post_bytes=inbound.get("sc_max_each_post_bytes"),
            sc_max_concurrent_posts=inbound.get("sc_max_concurrent_posts"),
            sc_min_posts_interval_ms=inbound.get("sc_min_posts_interval_ms"),
            x_padding_bytes=inbound.get("x_padding_bytes"),
            xmux=inbound.get("xmux", {}),
            downloadSettings=inbound.get("downloadSettings"),
            mode=inbound.get("mode", "auto"),
            noGRPCHeader=inbound.get("no_grpc_header"),
            heartbeatPeriod=inbound.get("heartbeat_period"),
            scStreamUpServerSecs=inbound.get("sc_stream_up_server_secs"),
            http_headers=inbound.get("http_headers"),
            request=inbound.get("request"),
            response=inbound.get("response"),
            mtu=inbound.get("mtu"),
            tti=inbound.get("tti"),
            uplinkCapacity=inbound.get("uplink_capacity"),
            downlinkCapacity=inbound.get("downlink_capacity"),
            congestion=inbound.get("congestion"),
            readBufferSize=inbound.get("read_buffer_size"),
            writeBufferSize=inbound.get("write_buffer_size"),
            idle_timeout=inbound.get("idle_timeout"),
            health_check_timeout=inbound.get("health_check_timeout"),
            permit_without_stream=inbound.get("permit_without_stream", False),
            initial_windows_size=inbound.get("initial_windows_size"),
        )

        mux_settings: dict = inbound.get("mux_settings", {})
        if mux_settings and (xray_mux := mux_settings.get("xray")):
            xray_mux = self._remove_none_values(xray_mux)
            outbound["mux"] = xray_mux

        self.add_config(remarks=remark, outbounds=outbounds)

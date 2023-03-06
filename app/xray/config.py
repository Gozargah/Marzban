import json
import re
from pathlib import PosixPath
from typing import Union

from config import XRAY_EXCLUDE_INBOUND_TAGS, XRAY_FALLBACKS_INBOUND_TAG


class XRayConfig(dict):
    def __init__(self,
                 config: Union[dict, str, PosixPath] = {},
                 api_host: str = "127.0.0.1",
                 api_port: int = 8080):
        if isinstance(config, str):
            try:
                # considering string as json
                jdata = re.sub(r'\/\/(.*)', '', config)
                config = json.loads(jdata)
            except json.JSONDecodeError:
                # considering string as file path
                with open(config, 'r') as file:
                    jdata = re.sub(r'\/\/(.*)', '', file.read())
                    config = json.loads(jdata)

        if isinstance(config, PosixPath):
            with open(config, 'r') as file:
                jdata = re.sub(r'\/\/(.*)', '', file.read())
                config = json.loads(jdata)

        self.api_host = api_host
        self.api_port = api_port

        super().__init__(config)
        self._validate()

        self.inbounds = []
        self.inbounds_by_protocol = {}
        self.inbounds_by_tag = {}
        self._fallbacks_inbound = self.get_inbound(XRAY_FALLBACKS_INBOUND_TAG)
        self._resolve_inbounds()

        self._apply_api()

    def _apply_api(self):
        if self.get_inbound("API_INBOUND"):
            return

        self["api"] = {
            "services": [
                "HandlerService",
                "StatsService",
                "LoggerService"
            ],
            "tag": "API"
        }
        self["stats"] = {}
        self["policy"] = {
            "levels": {
                "0": {
                    "statsUserUplink": True,
                    "statsUserDownlink": True
                }
            },
            "system": {
                "statsInboundDownlink": False,
                "statsInboundUplink": False,
                "statsOutboundDownlink": True,
                "statsOutboundUplink": True
            }
        }
        inbound = {
            "listen": self.api_host,
            "port": self.api_port,
            "protocol": "dokodemo-door",
            "settings": {
                "address": self.api_host
            },
            "tag": "API_INBOUND"
        }
        try:
            self["inbounds"].insert(0, inbound)
        except KeyError:
            self["inbounds"] = []
            self["inbounds"].insert(0, inbound)

        rule = {
            "inboundTag": [
                "API_INBOUND"
            ],
            "outboundTag": "API",
            "type": "field"
        }
        try:
            self["routing"]["rules"].insert(0, rule)
        except KeyError:
            self["routing"] = {"rules": []}
            self["routing"]["rules"].insert(0, rule)

    def _validate(self):
        if not self.get("inbounds"):
            raise ValueError("config doesn't have inbounds")

        if not self.get("outbounds"):
            raise ValueError("config doesn't have outbounds")

        for inbound in self['inbounds']:
            if not inbound.get("tag"):
                raise ValueError("all inbounds must have a unique tag")
        for outbound in self['outbounds']:
            if not outbound.get("tag"):
                raise ValueError("all outbounds must have a unique tag")

    def _resolve_inbounds(self):
        for inbound in self['inbounds']:
            if inbound['tag'] in XRAY_EXCLUDE_INBOUND_TAGS:
                continue

            settings = {
                "tag": inbound["tag"],
                "protocol": inbound["protocol"],
                "port": None,
                "network": "tcp",
                "tls": False,
                "sni": "",
                "path": "",
                "host": "",
                "header_type": "",
                "is_fallback": False
            }

            # port settings
            try:
                settings['port'] = inbound['port']
            except KeyError:
                if not self._fallbacks_inbound:
                    raise ValueError(
                        f"port missing on {inbound['tag']}"
                        "\nset XRAY_FALLBACKS_INBOUND_TAG if you're using an inbound containing fallbacks"
                    )
                try:
                    settings['port'] = self._fallbacks_inbound['port']
                    settings['is_fallback'] = True
                except KeyError:
                    raise ValueError("fallbacks inbound doesn't have port")

            # stream settings
            if stream := inbound.get('streamSettings'):
                net = stream.get('network', 'tcp')
                net_settings = stream.get(f"{net}Settings", {})
                security = stream.get("security")
                tls_settings = stream.get(f"{security}Settings")

                if settings['is_fallback'] is True:
                    # probably this is a fallback
                    security = self._fallbacks_inbound.get('streamSettings', {}).get('security')
                    tls_settings = self._fallbacks_inbound.get('streamSettings', {}).get(f"{security}Settings")

                settings['network'] = net
                settings['tls'] = security in ('tls', 'xtls')

                if tls_settings:
                    settings['sni'] = tls_settings.get('serverName', '')

                if net == 'tcp':
                    header = net_settings.get('header', {})
                    request = header.get('request', {})
                    path = request.get('path')
                    host = request.get('headers', {}).get('Host')

                    settings['header_type'] = header.get('type', '')

                    if isinstance(path, str) or isinstance(host, str):
                        raise ValueError(f"Settings of {inbound['tag']} for path and host must be list, not str\n"
                                         "https://xtls.github.io/config/transports/tcp.html#httpheaderobject")

                    if path and isinstance(path, list):
                        settings['path'] = path[0]

                    if host and isinstance(host, list):
                        settings['host'] = host[0]

                elif net == 'ws':
                    path = net_settings.get('path', '')
                    host = net_settings.get('headers', {}).get('Host')

                    settings['header_type'] = ''

                    if isinstance(path, list) or isinstance(host, list):
                        raise ValueError(f"Settings of {inbound['tag']} for path and host must be str, not list\n"
                                         "https://xtls.github.io/config/transports/websocket.html#websocketobject")

                    if isinstance(path, str):
                        settings['path'] = path

                    if isinstance(host, str):
                        settings['host'] = host

                elif net == 'grpc':
                    settings['header_type'] = ''
                    settings['path'] = net_settings.get('serviceName', '')
                    settings['host'] = ''

                else:
                    settings['path'] = net_settings.get('path', '')
                    host = net_settings.get('host', {}) or net_settings.get('Host', {})
                    if host and isinstance(host, list):
                        settings['path'] = host[0]
                    elif host and isinstance(host, str):
                        settings['path'] = host

            self.inbounds.append(settings)
            self.inbounds_by_tag[inbound['tag']] = settings

            try:
                self.inbounds_by_protocol[inbound['protocol']].append(settings)
            except KeyError:
                self.inbounds_by_protocol[inbound['protocol']] = [settings]

    def get_inbound(self, tag) -> dict:
        for inbound in self['inbounds']:
            if inbound['tag'] == tag:
                return inbound

    def get_outbound(self, tag) -> dict:
        for outbound in self['outbounds']:
            if outbound['tag'] == tag:
                return outbound

    def to_json(self, **json_kwargs):
        return json.dumps(self, **json_kwargs)

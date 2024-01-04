from __future__ import annotations

import json
from copy import deepcopy
from pathlib import PosixPath
from typing import Union

import commentjson

from app.db import GetDB, crud
from app.models.proxy import ProxySettings, ProxyTypes
from app.models.user import UserStatus
from app.utils.crypto import get_cert_SANs
from config import DEBUG, XRAY_EXCLUDE_INBOUND_TAGS, XRAY_FALLBACKS_INBOUND_TAG


class XRayConfig(dict):
    def __init__(self,
                 config: Union[dict, str, PosixPath] = {},
                 api_host: str = "127.0.0.1",
                 api_port: int = 8080):
        if isinstance(config, str):
            try:
                # considering string as json
                config = commentjson.loads(config)
            except (json.JSONDecodeError, ValueError):
                # considering string as file path
                with open(config, 'r') as file:
                    config = commentjson.loads(file.read())

        if isinstance(config, PosixPath):
            with open(config, 'r') as file:
                config = commentjson.loads(file.read())

        if isinstance(config, dict):
            config = deepcopy(config)

        self.api_host = api_host
        self.api_port = api_port

        super().__init__(config)
        self._validate()

        self.inbounds = []
        self.inbounds_by_protocol = {}
        self.inbounds_by_tag = {}
        self._fallbacks_inbound = self.get_inbound(XRAY_FALLBACKS_INBOUND_TAG)
        self._addr_clients_by_tag = {}
        self._resolve_inbounds()

        self._apply_api()

    def _apply_api(self):
        api_inbound = self.get_inbound("API_INBOUND")
        if api_inbound:
            api_inbound["listen"] = self.api_host
            api_inbound["listen"]["address"] = self.api_host
            api_inbound["port"] = self.api_port
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
            if not inbound['protocol'] in ProxyTypes._value2member_map_:
                continue

            if inbound['tag'] in XRAY_EXCLUDE_INBOUND_TAGS:
                continue

            if not inbound.get('settings'):
                inbound['settings'] = {}
            if not inbound['settings'].get('clients'):
                inbound['settings']['clients'] = []
            self._addr_clients_by_tag[inbound['tag']
                                      ] = inbound['settings']['clients']

            settings = {
                "tag": inbound["tag"],
                "protocol": inbound["protocol"],
                "port": None,
                "network": "tcp",
                "tls": 'none',
                "sni": [],
                "host": [],
                "path": "",
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
                    security = self._fallbacks_inbound.get(
                        'streamSettings', {}).get('security')
                    tls_settings = self._fallbacks_inbound.get(
                        'streamSettings', {}).get(f"{security}Settings", {})

                settings['network'] = net

                if security == 'tls':
                    # settings['fp']
                    # settings['alpn']
                    settings['tls'] = 'tls'
                    for certificate in tls_settings.get('certificates', []):

                        if certificate.get("certificateFile", None):
                            with open(certificate['certificateFile'], 'rb') as file:
                                cert = file.read()
                                settings['sni'].extend(get_cert_SANs(cert))

                        if certificate.get("certificate", None):
                            cert = certificate['certificate']
                            if isinstance(cert, list):
                                cert = '\n'.join(cert)
                            if isinstance(cert, str):
                                cert = cert.encode()
                            settings['sni'].extend(get_cert_SANs(cert))

                elif security == 'reality':
                    settings['fp'] = 'chrome'
                    settings['tls'] = 'reality'
                    settings['sni'] = tls_settings.get('serverNames', [])

                    try:
                        settings['pbk'] = tls_settings['publicKey']
                    except KeyError:
                        pvk = tls_settings.get('privateKey')
                        if not pvk:
                            raise ValueError(
                                f"You need to provide privateKey in realitySettings of {inbound['tag']}")

                        try:
                            from app.xray import core
                            x25519 = core.get_x25519(pvk)
                            settings['pbk'] = x25519['public_key']
                        except ImportError:
                            pass

                        if not settings.get('pbk'):
                            raise ValueError(
                                f"You need to provide publicKey in realitySettings of {inbound['tag']}")

                    try:
                        settings['sid'] = tls_settings.get('shortIds')[0]
                    except (IndexError, TypeError):
                        raise ValueError(
                            f"You need to define at least one shortID in realitySettings of {inbound['tag']}")

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
                        settings['host'] = host

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
                        settings['host'] = [host]

                elif net == 'grpc':
                    settings['header_type'] = ''
                    settings['path'] = net_settings.get('serviceName', '')
                    settings['host'] = []

                elif net == 'quic':
                    settings['header_type'] = net_settings.get('header', {}).get('type', '')
                    settings['path'] = net_settings.get('key', '')
                    settings['host'] = [net_settings.get('security', '')]

                else:
                    settings['path'] = net_settings.get('path', '')
                    host = net_settings.get(
                        'host', {}) or net_settings.get('Host', {})
                    if host and isinstance(host, list):
                        settings['host'] = host[0]
                    elif host and isinstance(host, str):
                        settings['host'] = host

            self.inbounds.append(settings)
            self.inbounds_by_tag[inbound['tag']] = settings

            try:
                self.inbounds_by_protocol[inbound['protocol']].append(settings)
            except KeyError:
                self.inbounds_by_protocol[inbound['protocol']] = [settings]

    def add_inbound_client(self, inbound_tag: str, email: str, settings: dict):
        inbound = self.inbounds_by_tag.get(inbound_tag, {})
        client = {"email": email, **settings}

        # XTLS currently only supports transmission methods of TCP and mKCP
        if client.get('flow') and (
            inbound.get('network', 'tcp') not in ('tcp', 'kcp')
            or
            (
                inbound.get('network', 'tcp') in ('tcp', 'kcp')
                and
                inbound.get('tls') not in ('tls', 'reality')
            )
            or
            inbound.get('header_type') == 'http'
        ):
            del client['flow']

        try:
            self._addr_clients_by_tag[inbound_tag].append(client)
        except KeyError:
            return
        return client

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

    def copy(self):
        return deepcopy(self)

    def include_db_users(self) -> XRayConfig:
        config = self.copy()

        with GetDB() as db:
            for user in crud.get_users(db, status=[UserStatus.active,
                                                   UserStatus.on_hold]):
                proxies_settings = {
                    p.type: ProxySettings.from_dict(
                        p.type, p.settings).dict(no_obj=True)
                    for p in user.proxies
                }
                for proxy_type, inbound_tags in user.inbounds.items():
                    for inbound_tag in inbound_tags:
                        config.add_inbound_client(inbound_tag,
                                                  f"{user.id}.{user.username}",
                                                  proxies_settings[proxy_type])

        if DEBUG:
            with open('generated_config-debug.json', 'w') as f:
                f.write(config.to_json(indent=4))

        return config

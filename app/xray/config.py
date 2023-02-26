import json
import re
from pathlib import PosixPath
from typing import Union


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

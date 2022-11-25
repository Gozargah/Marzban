import atexit

from app.utils import check_port
from app.xray.config import XRayConfig
from app.xray.core import XRayCore
from xray_api import XRay
from xray_api import exceptions
from xray_api import exceptions as exc
from xray_api import types

from config import XRAY_ASSETS_PATH, XRAY_EXECUTABLE_PATH, XRAY_JSON

# Search for a free API port from 8080
try:
    for api_port in range(8080, 65536):
        if not check_port(api_port):
            break
finally:
    config = XRayConfig(XRAY_JSON, api_port=api_port)
    del api_port


core = XRayCore(XRAY_EXECUTABLE_PATH, XRAY_ASSETS_PATH)
core.start(config)


@atexit.register
def stop_core():
    if core.started:
        core.stop()


api = XRay(config.api_host, config.api_port)


INBOUND_PORTS = {inbound['protocol']: inbound['port'] for inbound in config['inbounds']}
INBOUND_TAGS = {inbound['protocol']: inbound['tag'] for inbound in config['inbounds']}
INBOUND_STREAMS = {inbound['protocol']: (
                   {
                       "net": inbound['streamSettings'].get('network', 'tcp'),
                       "tls": inbound['streamSettings'].get('security') in ('tls', 'xtls'),
                       "sni": (
                           inbound['streamSettings'].get('tlsSettings') or
                           inbound['streamSettings'].get('xtlsSettings') or
                           {}
                       ).get('serverName', ''),
                       "path": inbound['streamSettings'].get(
                           f"{inbound['streamSettings'].get('network', 'tcp')}Settings", {}
                       ).get('path', '')
                   }
                   if inbound.get('streamSettings') else
                   {
                       "net": "tcp",
                       "tls": False,
                       "sni": "",
                       "path": ""
                   }
                   ) for inbound in config['inbounds']}


__all__ = [
    "config",
    "core",
    "api",
    "exceptions",
    "exc",
    "types",
    "INBOUND_PORTS",
    "INBOUND_TAGS",
    "INBOUND_STREAMS"
]

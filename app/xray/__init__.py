from random import randint
from typing import Dict

from app import app
from app.models.host import ProxyHostSecurity
from app.utils.store import DictStorage
from app.utils.system import check_port
from app.xray import operations
from app.xray.config import XRayConfig
from app.xray.core import XRayCore
from app.xray.node import XRayNode
from config import XRAY_ASSETS_PATH, XRAY_EXECUTABLE_PATH, XRAY_JSON
from xray_api import XRay as XRayAPI
from xray_api import exceptions, types
from xray_api import exceptions as exc

core = XRayCore(XRAY_EXECUTABLE_PATH, XRAY_ASSETS_PATH)

# Search for a free API port
try:
    for api_port in range(randint(10000, 60000), 65536):
        if not check_port(api_port):
            break
finally:
    config = XRayConfig(XRAY_JSON, api_port=api_port)
    del api_port

api = XRayAPI(config.api_host, config.api_port)

nodes: Dict[int, XRayNode] = {}


@DictStorage
def hosts(storage: dict):
    from app.db import GetDB, crud

    storage.clear()
    with GetDB() as db:
        db_hosts = crud.get_hosts(db)

        for host in db_hosts:
            if host.is_disabled or (config.get_inbound(host.inbound_tag) is None):
                continue

            storage[host.id] = {
                "remark": host.remark,
                "inbound_tag": host.inbound_tag,
                "address": [i.strip() for i in host.address.split(',')] if host.address else [],
                "port": host.port,
                "path": host.path if host.path else None,
                "sni": [i.strip() for i in host.sni.split(',')] if host.sni else [],
                "host": [i.strip() for i in host.host.split(',')] if host.host else [],
                "alpn": host.alpn.value,
                "fingerprint": host.fingerprint.value,
                # None means the tls is not specified by host itself and
                #  complies with its inbound's settings.
                "tls": None
                if host.security == ProxyHostSecurity.inbound_default
                else host.security.value,
                "allowinsecure": host.allowinsecure,
                "mux_enable": host.mux_enable,
                "fragment_setting": host.fragment_setting,
                "noise_setting": host.noise_setting,
                "random_user_agent": host.random_user_agent,
            }


@app.on_event("startup")
def on_startup():
    hosts.update()


__all__ = [
    "config",
    "hosts",
    "core",
    "api",
    "nodes",
    "operations",
    "exceptions",
    "exc",
    "types",
    "XRayConfig",
    "XRayCore",
    "XRayNode",
]

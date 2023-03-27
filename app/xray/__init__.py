from random import randint

from app.utils.system import check_port
from app.xray.config import XRayConfig
from app.xray.core import XRayCore
from app.xray.node import XRayNode
from app.xray import operations
from config import XRAY_ASSETS_PATH, XRAY_EXECUTABLE_PATH, XRAY_JSON
from xray_api import XRay
from xray_api import exceptions
from xray_api import exceptions as exc
from xray_api import types

# Search for a free API port
try:
    for api_port in range(randint(10000, 60000), 65536):
        if not check_port(api_port):
            break
finally:
    config = XRayConfig(XRAY_JSON, api_port=api_port)
    del api_port


core = XRayCore(XRAY_EXECUTABLE_PATH, XRAY_ASSETS_PATH)
api = XRay(config.api_host, config.api_port)


__all__ = [
    "config",
    "core",
    "api",
    "operations",
    "exceptions",
    "exc",
    "types",
    "XRayConfig",
    "XRayCore",
    "XRayNode",
]

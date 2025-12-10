import importlib.util
import json
import sys

# Provide a lightweight shim for commentjson if not installed so we can
# import the config module for a quick unit test without installing deps.
if 'commentjson' not in sys.modules:
    import types
    shim = types.SimpleNamespace()
    shim.loads = json.loads
    sys.modules['commentjson'] = shim

# Create minimal shims for modules that `config.py` imports from the package
# so we can load it without installing the full application dependencies.
if 'app.db' not in sys.modules:
    import types
    mod = types.ModuleType('app.db')
    class DummyCtx:
        def __enter__(self):
            return None
        def __exit__(self, exc_type, exc, tb):
            return False
    def GetDB():
        return DummyCtx()
    mod.GetDB = GetDB
    # crud.get_users will not be used in our quick test, provide a stub
    mod.crud = types.SimpleNamespace(get_users=lambda db, status=None: [])
    sys.modules['app.db'] = mod

if 'app.models.proxy' not in sys.modules:
    import types
    modp = types.ModuleType('app.models.proxy')
    # Provide ProxyTypes minimal enum used in config
    from enum import Enum
    class ProxyTypes(str, Enum):
        VMess = 'vmess'
        VLESS = 'vless'
        Trojan = 'trojan'
        Shadowsocks = 'shadowsocks'
    modp.ProxyTypes = ProxyTypes
    # ProxySettings stub
    class ProxySettings:
        @classmethod
        def from_dict(cls, proxy_type, d):
            return d
    modp.ProxySettings = ProxySettings
    sys.modules['app.models.proxy'] = modp

if 'app.models.user' not in sys.modules:
    import types
    modu = types.ModuleType('app.models.user')
    class UserStatus:
        active = 'active'
        on_hold = 'on_hold'
    modu.UserStatus = UserStatus
    sys.modules['app.models.user'] = modu

if 'app.utils.crypto' not in sys.modules:
    import types
    modc = types.ModuleType('app.utils.crypto')
    def get_cert_SANs(cert):
        return []
    modc.get_cert_SANs = get_cert_SANs
    sys.modules['app.utils.crypto'] = modc

# shim top-level config module used by the project
if 'config' not in sys.modules:
    import types
    confmod = types.ModuleType('config')
    confmod.DEBUG = False
    confmod.XRAY_EXCLUDE_INBOUND_TAGS = []
    confmod.XRAY_FALLBACKS_INBOUND_TAG = None
    sys.modules['config'] = confmod

# load module directly without importing app package
spec = importlib.util.spec_from_file_location('xray_config', r'c:\Users\evgen\Documents\GitHub\Marzban\app\xray\config.py')
mod = importlib.util.module_from_spec(spec)
spec.loader.exec_module(mod)
XRayConfig = mod.XRayConfig

# minimal config template
base_config = {
    "inbounds": [
        {
            "listen": "0.0.0.0",
            "port": 10086,
            "protocol": "vless",
            "settings": {
                "clients": []
            },
            "streamSettings": {
                "network": "tcp",
                "tcpSettings": {
                    "header": {
                        "type": "http",
                        "request": {
                            "path": ["/"],
                            "headers": {"Host": ["example.com"]}
                        }
                    }
                },
                "security": "reality",
                "realitySettings": {
                    "serverNames": ["example.com"],
                    "publicKey": "TEST_PUBLIC_KEY",
                    "shortIds": ["abcd"]
                }
            },
            "tag": "TEST_REALITY"
        }
    ],
    "outbounds": [{"tag": "direct", "protocol": "freedom"}]
}

print('Case 1: publicKey provided under publicKey')
conf = XRayConfig(json.dumps(base_config))
print('-> inbounds parsed:', conf.inbounds)

# case 2: publicKey missing, privateKey present (simulate get_x25519 returning None by not having xray binary)
print('\nCase 2: privateKey provided, no publicKey')
base_config['inbounds'][0]['streamSettings']['realitySettings'].pop('publicKey', None)
base_config['inbounds'][0]['streamSettings']['realitySettings']['privateKey'] = 'TEST_PRIVATE_KEY'
try:
    conf2 = XRayConfig(json.dumps(base_config))
    print('-> inbounds parsed:', conf2.inbounds)
except Exception as e:
    print('-> raised:', type(e).__name__, str(e))

# case 3: neither key provided
print('\nCase 3: neither publicKey nor privateKey provided')
base_config['inbounds'][0]['streamSettings']['realitySettings'].pop('privateKey', None)
try:
    conf3 = XRayConfig(json.dumps(base_config))
    print('-> inbounds parsed:', conf3.inbounds)
except Exception as e:
    print('-> raised:', type(e).__name__, str(e))

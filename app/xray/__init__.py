from random import randint
from typing import TYPE_CHECKING, Dict, Optional, Sequence

from app.models.proxy import ProxyHostSecurity
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

# The `from app.xray.config import XRayConfig` and
# `from app.xray.core import XRayCore` imports above implicitly attach
# the `config` and `core` submodules to this package's namespace —
# Python's import machinery does this for every `from pkg.sub import X`.
# That submodule binding would shadow our lazy `__getattr__` below (which
# is only consulted when a name is NOT already in the module dict). Drop
# the shortcuts here so `xray.config` and `xray.core` route through the
# lazy initialisation path. `sys.modules["app.xray.config"]` etc. are
# unaffected, so internal `from app.xray.config import XRayConfig` keeps
# working.
del config  # noqa: F821  (added implicitly by the submodule import above)
del core    # noqa: F821  (same)

# -----------------------------------------------------------------------------
# Lazy Xray subsystem initialisation (PEP 562)
# -----------------------------------------------------------------------------
# Before Task 3 this module performed three import-time side effects:
#   • XRayCore(...) -> subprocess `xray version`     (deferred in Task 3 commit 1)
#   • Free-port scan via check_port() loop           (deferred here)
#   • XRayConfig(XRAY_JSON, ...) -> file read        (deferred here)
# Construction of `core`, `config`, and `api` is now deferred until the
# first attribute access via a module-level `__getattr__`. In production
# the lifespan startup hook will trigger initialisation in
# `app/__init__.py`; in tests, `init_for_tests(stub_config)` bootstraps
# the module without any I/O.

_core: "Optional[XRayCore]" = None
_config: "Optional[XRayConfig]" = None
_api: "Optional[XRayAPI]" = None
_api_port: "Optional[int]" = None
_initialized: bool = False

# `nodes` is just an empty registry at import — no I/O — so it stays
# eagerly defined. `operations`, `exc`, `exceptions`, `types`,
# `XRayConfig`, `XRayCore`, `XRayNode` are pure imports of their own
# modules (none of which do I/O at import) and stay eager too.
nodes: Dict[int, XRayNode] = {}


def _initialize() -> None:
    """Bring up `core`, `config`, `api`. Idempotent.

    Does subprocess (lazily on first ``_core.version`` access),
    TCP port scan, and file read. Production callers should not call
    this directly — module ``__getattr__`` invokes it on first read.
    """
    global _core, _config, _api, _api_port, _initialized
    if _initialized:
        return

    _core = XRayCore(XRAY_EXECUTABLE_PATH, XRAY_ASSETS_PATH)

    # Search for a free API port.
    port = None
    try:
        for port in range(randint(10000, 60000), 65536):
            if not check_port(port):
                break
    finally:
        _api_port = port
        _config = XRayConfig(XRAY_JSON, api_port=port)

    _api = XRayAPI(_config.api_host, _config.api_port)
    _initialized = True


def init_for_tests(config: "XRayConfig",
                   core: "Optional[XRayCore]" = None) -> None:
    """Bootstrap the module with a pre-built config (and optional core)
    without doing any subprocess / socket / network I/O.

    Intended for test conftests only. Calling this lets tests that need
    ``xray.config`` access (e.g. the contract tests in
    ``tests/test_lookups.py`` that monkeypatch
    ``xray.config.inbounds_by_protocol``) work without an Xray binary
    or free local ports.

    XRayCore construction itself is side-effect-free after Task 3
    commit 1 (the ``xray version`` subprocess is a cached_property,
    deferred until ``.version`` is read), so the default-constructed
    instance is safe.
    """
    global _core, _config, _api, _api_port, _initialized
    _config = config
    _api = XRayAPI(_config.api_host, _config.api_port)
    _api_port = _config.api_port
    _core = core if core is not None else XRayCore(XRAY_EXECUTABLE_PATH, XRAY_ASSETS_PATH)
    _initialized = True


def __getattr__(name: str):
    # PEP 562 module __getattr__ — called only for names not found in
    # the module's globals. `core`, `config`, `api` are intentionally
    # not at module top level so attribute access lands here and we
    # can lazy-initialise.
    if name in ("core", "config", "api"):
        if not _initialized:
            _initialize()
        return {"core": _core, "config": _config, "api": _api}[name]
    raise AttributeError(f"module {__name__!r} has no attribute {name!r}")


if TYPE_CHECKING:
    from app.db.models import ProxyHost


@DictStorage
def hosts(storage: dict):
    # Use explicit `from app import xray; xray.config.*` so the access
    # routes through the module __getattr__ (PEP 562) and triggers
    # lazy initialisation if needed. A free `config` reference would
    # NameError under the new scheme — module __getattr__ is only
    # invoked by attribute access, not by global-name lookup inside
    # a function body.
    from app import xray
    from app.db import GetDB, crud

    storage.clear()
    with GetDB() as db:
        for inbound_tag in xray.config.inbounds_by_tag:
            inbound_hosts: Sequence[ProxyHost] = crud.get_hosts(db, inbound_tag)

            storage[inbound_tag] = [
                {
                    "remark": host.remark,
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
                    "use_sni_as_host": host.use_sni_as_host,
                } for host in inbound_hosts if not host.is_disabled
            ]


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
    "init_for_tests",
]

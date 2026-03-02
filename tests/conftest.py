"""
Shared pytest configuration.

IMPORTANT: environment variables and sys.modules stubs MUST be set at module
level here, before any test module is imported.  pytest loads conftest.py
before collecting tests, so this file is the correct place for them.
"""

import os
import sys
from enum import Enum
from types import ModuleType
from unittest.mock import MagicMock

# ── 1. Test environment variables ─────────────────────────────────────────────
# These are read by config.py via python-decouple, which checks os.environ
# first (before .env files).  Must be set before any import of config or app.

os.environ.setdefault("SQLALCHEMY_DATABASE_URL", "sqlite:///:memory:")
os.environ.setdefault("HYSTERIA2_HOOK_TOKEN", "test-token-xyz")
os.environ.setdefault("HYSTERIA2_TRAFFIC_SECRET", "test-traffic-secret")
os.environ.setdefault("HYSTERIA2_TRAFFIC_LISTEN", "127.0.0.1:19999")
os.environ.setdefault("XRAY_JSON", "/dev/null")
os.environ.setdefault("SUDO_USERNAME", "")
os.environ.setdefault("SUDO_PASSWORD", "")
os.environ.setdefault("TELEGRAM_API_TOKEN", "")


# ── 2. Stub xray_api (not installed locally) ──────────────────────────────────
# xray_api is only available inside the Docker container.  Provide lightweight
# stubs so app/models/proxy.py and related code can be imported in isolation.


class _XTLSFlows(str, Enum):
    NONE = ""
    VISION = "xtls-rprx-vision"


class _ShadowsocksMethods(str, Enum):
    CHACHA20_POLY1305 = "chacha20-ietf-poly1305"
    AES_128_GCM = "aes-128-gcm"
    AES_256_GCM = "aes-256-gcm"


_types_account = ModuleType("xray_api.types.account")
_types_account.XTLSFlows = _XTLSFlows  # type: ignore[attr-defined]
_types_account.ShadowsocksMethods = _ShadowsocksMethods  # type: ignore[attr-defined]
# The remaining classes are only used to build Xray gRPC calls — not needed here
_types_account.ShadowsocksAccount = MagicMock  # type: ignore[attr-defined]
_types_account.TrojanAccount = MagicMock  # type: ignore[attr-defined]
_types_account.VLESSAccount = MagicMock  # type: ignore[attr-defined]
_types_account.VMessAccount = MagicMock  # type: ignore[attr-defined]

_xray_api_mod = ModuleType("xray_api")
_xray_api_mod.XRay = MagicMock  # type: ignore[attr-defined]
_xray_api_types = ModuleType("xray_api.types")
_xray_api_exc = ModuleType("xray_api.exc")
_xray_api_exceptions = ModuleType("xray_api.exceptions")

for _mod in (_xray_api_mod, _xray_api_types, _xray_api_exc,
             _xray_api_exceptions, _types_account):
    sys.modules.setdefault(_mod.__name__, _mod)


# ── 3. Stub app.xray subpackage ───────────────────────────────────────────────
# app.xray.__init__ starts a real Xray process and reads xray_config.json.
# We need a proper package-like module so `from app.xray.socks import x` works.

def _make_pkg_mock(name: str) -> MagicMock:
    m = MagicMock()
    m.__name__ = name
    m.__path__ = []          # marks it as a package so submodule imports work
    m.__package__ = name
    m.__spec__ = None
    return m


_app_xray_mock = _make_pkg_mock("app.xray")
_app_xray_mock.config.inbounds_by_tag = {}
_app_xray_mock.config.api_host = "127.0.0.1"
_app_xray_mock.config.api_port = 62789
_app_xray_mock.nodes = {}

for _name in (
    "app.xray",
    "app.xray.config",
    "app.xray.core",
    "app.xray.operations",
    "app.xray.node",
    "app.xray.socks",          # used by app/routers/subscription.py
):
    if _name not in sys.modules:
        sys.modules[_name] = _make_pkg_mock(_name)

# Top-level key must be the rich mock (with config/nodes attrs)
sys.modules["app.xray"] = _app_xray_mock


# ── 4. Stub telebot (pyTelegramBotAPI) ────────────────────────────────────────
# Use MagicMock for all telebot submodules so any `from telebot.x import Y`
# resolves to a MagicMock attribute without raising ImportError.
for _tname in (
    "telebot",
    "telebot.types",
    "telebot.apihelper",
    "telebot.handler_backends",
    "telebot.formatting",
    "telebot.callback_data",
    "telebot.custom_filters",
    "telebot.util",
    "telebot.storage",
):
    if _tname not in sys.modules:
        _m = MagicMock()
        _m.__name__ = _tname
        _m.__path__ = []          # makes Python treat it as a package
        _m.__package__ = _tname
        sys.modules[_tname] = _m


# ── 5. Shared fixtures ────────────────────────────────────────────────────────

import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker


@pytest.fixture(scope="session")
def test_engine():
    """SQLite in-memory engine shared across the session."""
    from app.db.base import Base
    engine = create_engine(
        "sqlite:///:memory:",
        connect_args={"check_same_thread": False},
    )
    Base.metadata.create_all(engine)
    yield engine
    engine.dispose()


@pytest.fixture
def db_session(test_engine):
    """Transactional session that rolls back after every test."""
    Session = sessionmaker(bind=test_engine)
    session = Session()
    yield session
    session.rollback()
    session.close()

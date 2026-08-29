"""Shared fixtures for the suite.

The environment is pinned here, before anything imports config.py: decouple
reads the environment at import time and load_dotenv() leaves already-set
variables alone, so this is what keeps a developer's own .env out of the tests.
"""

import os

os.environ.update(
    {
        "DEBUG": "false",
        # Import-time default only, so nothing points at db.sqlite3 while the
        # modules load. The `db` fixture rebinds SessionLocal per test.
        "SQLALCHEMY_DATABASE_URL": "sqlite://",
        "SUDO_USERNAME": "",
        "SUDO_PASSWORD": "",
        "TELEGRAM_API_TOKEN": "",
        "DISCORD_WEBHOOK_URL": "",
        "WEBHOOK_ADDRESS": "",
        "XRAY_SUBSCRIPTION_PATH": "sub",
        "XRAY_SUBSCRIPTION_URL_PREFIX": "",
    }
)

import json  # noqa: E402
import subprocess  # noqa: E402

import pytest  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402
from sqlalchemy import create_engine  # noqa: E402
from sqlalchemy.orm import sessionmaker  # noqa: E402
from sqlalchemy.pool import StaticPool  # noqa: E402

from app import app as fastapi_app  # noqa: E402
from app import db as app_db  # noqa: E402
from app import xray  # noqa: E402
from app.db import base as db_base  # noqa: E402
from app.db import crud, get_db  # noqa: E402
from app.db.base import Base  # noqa: E402
from app.models.admin import AdminCreate, pwd_context  # noqa: E402
from app.models.user import UserCreate  # noqa: E402
from app.utils import jwt as jwt_utils  # noqa: E402
from app.utils import nginx  # noqa: E402
from app.utils import sysctl  # noqa: E402
from app.utils.sysctl_catalog import TUNABLES  # noqa: E402

# bcrypt at its production cost factor is ~0.25s per hash, which the admin
# fixtures pay several times per test. The suite is not testing bcrypt itself.
pwd_context.update(bcrypt__default_rounds=4)

JWT_SECRET = "conftest-secret"

# One inbound per protocol the panel supports, each on a different transport,
# so a test can pick the combination it cares about by tag.
XRAY_CONFIG = {
    "log": {"loglevel": "warning"},
    "inbounds": [
        {
            "tag": "VMESS TCP",
            "protocol": "vmess",
            "listen": "0.0.0.0",
            "port": 2001,
            "settings": {"clients": []},
            "streamSettings": {"network": "tcp"},
        },
        {
            "tag": "VLESS WS",
            "protocol": "vless",
            "listen": "0.0.0.0",
            "port": 2002,
            "settings": {"clients": [], "decryption": "none"},
            "streamSettings": {
                "network": "ws",
                "wsSettings": {"path": "/vless"},
                "security": "tls",
                "tlsSettings": {"serverName": "vless.example.com", "certificates": []},
            },
        },
        {
            "tag": "TROJAN GRPC",
            "protocol": "trojan",
            "listen": "0.0.0.0",
            "port": 2003,
            "settings": {"clients": []},
            "streamSettings": {"network": "grpc", "grpcSettings": {"serviceName": "tj"}},
        },
        {
            "tag": "SHADOWSOCKS TCP",
            "protocol": "shadowsocks",
            "listen": "0.0.0.0",
            "port": 2004,
            "settings": {"clients": [], "network": "tcp,udp"},
        },
    ],
    "outbounds": [{"protocol": "freedom", "tag": "DIRECT"}],
}


def make_host(**overrides) -> dict:
    """One entry of xray.hosts, shaped the way app.xray.hosts builds them."""
    host = {
        "remark": "{USERNAME} ({PROTOCOL} - {TRANSPORT})",
        "address": ["example.com"],
        "port": None,
        "path": None,
        "sni": [],
        "host": [],
        "alpn": "",
        "fingerprint": "",
        "tls": None,
        "allowinsecure": False,
        "mux_enable": False,
        "fragment_setting": "",
        "noise_setting": "",
        "random_user_agent": False,
        "use_sni_as_host": False,
    }
    host.update(overrides)
    return host


@pytest.fixture(autouse=True)
def jwt_secret(monkeypatch):
    """A fixed signing key, so no test ever reads one out of a database."""
    monkeypatch.setattr(jwt_utils, "get_secret_key", lambda: JWT_SECRET)


@pytest.fixture(autouse=True)
def xray_config(monkeypatch):
    """Replace the config loaded from XRAY_JSON with the one above."""
    config = xray.XRayConfig(json.dumps(XRAY_CONFIG), api_port=8080)
    monkeypatch.setattr(xray, "config", config)
    return config


@pytest.fixture(autouse=True)
def hosts(monkeypatch, xray_config):
    """A default host per inbound. Mutate the lists to test host overrides."""
    mapping = {tag: [make_host()] for tag in xray_config.inbounds_by_tag}
    monkeypatch.setattr(xray, "hosts", mapping)
    return mapping


@pytest.fixture(autouse=True)
def no_xray_calls(monkeypatch):
    """Keep the real Xray operations off the network.

    Every call is recorded as (operation, username) so a test can assert the
    panel told Xray about a change without a core running.
    """
    calls = []

    def record(name):
        def op(dbuser=None, **kwargs):
            calls.append((name, getattr(dbuser, "username", None)))

        return op

    for name in ("add_user", "update_user", "remove_user"):
        monkeypatch.setattr(xray.operations, name, record(name))

    # Endpoints that rebuild the whole config would otherwise try to exec the
    # xray binary, which is not installed on a machine running the tests.
    monkeypatch.setattr(xray.core, "restart", lambda config: calls.append(("restart_core", None)))
    monkeypatch.setattr(
        xray.operations, "restart_node", lambda node_id, config: calls.append(("restart_node", node_id))
    )

    return calls


@pytest.fixture
def db(monkeypatch):
    """A fresh in-memory database, shared with anything that opens its own session.

    StaticPool keeps every connection pointed at the same in-memory database:
    the API client serves requests on another thread, and the default pool
    would hand that thread an empty one. SessionLocal is rebound as well so
    code reaching for GetDB() lands here rather than on a real database.
    """
    engine = create_engine(
        "sqlite://", connect_args={"check_same_thread": False}, poolclass=StaticPool
    )
    Base.metadata.create_all(engine)
    session_factory = sessionmaker(bind=engine)
    monkeypatch.setattr(db_base, "SessionLocal", session_factory)
    monkeypatch.setattr(app_db, "SessionLocal", session_factory)

    session = session_factory()
    yield session
    session.close()


@pytest.fixture
def sudo_admin(db):
    return crud.create_admin(db, AdminCreate(username="root", password="rootpw", is_sudo=True))


@pytest.fixture
def plain_admin(db):
    return crud.create_admin(db, AdminCreate(username="reseller", password="resellerpw", is_sudo=False))


@pytest.fixture
def client(db):
    """An API client wired to the test database.

    Deliberately not used as a context manager: entering one would run the
    startup handlers, which start the scheduler and build the dashboard.
    That leaves `on_startup` itself uncovered here, so it is exercised
    directly in test_app_startup.py instead.
    """

    def override_db():
        yield db

    fastapi_app.dependency_overrides[get_db] = override_db
    yield TestClient(fastapi_app)
    fastapi_app.dependency_overrides.clear()


def auth(admin) -> dict:
    """Authorization header for an admin, signed with the fixture secret."""
    token = jwt_utils.create_admin_token(admin.username, is_sudo=admin.is_sudo)
    return {"Authorization": f"Bearer {token}"}


def new_user(username: str, **overrides) -> UserCreate:
    """A UserCreate with every inbound of its protocols enabled.

    `inbounds={}` has to be passed explicitly: the field validator that fills
    in the tags does not run on the default value.
    """
    payload = {"username": username, "proxies": {"vmess": {}}, "inbounds": {}}
    payload.update(overrides)
    return UserCreate(**payload)


@pytest.fixture
def proc(tmp_path, monkeypatch):
    """A stand-in /proc/sys holding the baseline values.

    Kernel tuning is tested against a directory tree rather than the real
    /proc/sys: the suite has to run on a developer's machine and in CI without
    touching either one's kernel.
    """
    root = tmp_path / "proc"
    for tunable in TUNABLES:
        path = root / tunable.proc_path
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(tunable.baseline + "\n")

    monkeypatch.setattr(sysctl, "SYSCTL_PROC_PATH", str(root))
    return root


@pytest.fixture
def conf(tmp_path, monkeypatch):
    """The managed sysctl.d file, somewhere harmless."""
    directory = tmp_path / "sysctl.d"
    directory.mkdir()
    path = directory / "99-xenith.conf"
    monkeypatch.setattr(sysctl, "SYSCTL_CONF_PATH", str(path))
    return path


@pytest.fixture
def enabled(monkeypatch):
    monkeypatch.setattr(sysctl, "SYSCTL_ENABLED", True)


@pytest.fixture
def sysctl_runs(monkeypatch):
    """Stand in for the sysctl binary, recording how it was invoked."""
    calls = []

    def fake_run(args, **kwargs):
        calls.append(args)
        return subprocess.CompletedProcess(args, 0, stdout="", stderr="")

    monkeypatch.setattr(sysctl.subprocess, "run", fake_run)
    return calls


@pytest.fixture
def tunable_host(enabled, proc, conf, sysctl_runs):
    """Everything kernel tuning needs, wired to temporary files."""
    return sysctl_runs


@pytest.fixture
def nginx_host(tmp_path, monkeypatch):
    """A stand-in /etc/nginx, web root and log directory.

    nginx itself is never installed for the tests; only the files it would read
    are, so the path handling can be exercised without a server.
    """
    tree = {
        "sites_available": tmp_path / "nginx/sites-available",
        "sites_enabled": tmp_path / "nginx/sites-enabled",
        "webroot": tmp_path / "www",
        "logs": tmp_path / "log/nginx",
    }
    for path in tree.values():
        path.mkdir(parents=True)

    monkeypatch.setattr(nginx, "NGINX_ENABLED", True)
    monkeypatch.setattr(nginx, "NGINX_CONF_DIR", str(tmp_path / "nginx"))
    monkeypatch.setattr(nginx, "NGINX_SITES_AVAILABLE", str(tree["sites_available"]))
    monkeypatch.setattr(nginx, "NGINX_SITES_ENABLED", str(tree["sites_enabled"]))
    monkeypatch.setattr(nginx, "NGINX_WEBROOT", str(tree["webroot"]))
    monkeypatch.setattr(nginx, "NGINX_LOG_DIR", str(tree["logs"]))
    return tree


@pytest.fixture
def nginx_runs(monkeypatch):
    """Stand in for the nginx binary, recording how it was invoked.

    Returns the call list; assign to `nginx_runs.result` through the returned
    controller to make a call fail.
    """
    class Calls(list):
        """The argument lists nginx was called with, plus a knob to make it fail.

        `outcome` is per instance on purpose: as a class attribute it would be
        one dict shared by every test, and a failure set up in one would leak
        into the next.
        """

        def __init__(self):
            super().__init__()
            self.outcome = {
                "returncode": 0,
                "stderr": "nginx: configuration file /etc/nginx/nginx.conf test is successful\n",
            }

    calls = Calls()
    outcome = calls.outcome

    def fake_run(args, **kwargs):
        calls.append(args)
        if args[1:2] == ["-v"]:
            return subprocess.CompletedProcess(args, 0, stdout="", stderr="nginx version: nginx/1.24.0\n")
        if args[1:2] == ["-T"]:
            return subprocess.CompletedProcess(
                args, 0, stdout="server {\n listen 80;\n listen 443 ssl;\n}\n", stderr=""
            )
        return subprocess.CompletedProcess(
            args, outcome["returncode"], stdout="", stderr=outcome["stderr"]
        )

    monkeypatch.setattr(nginx.subprocess, "run", fake_run)
    return calls

"""Isolated test environment.

The app reads its settings at import time, so the temp database and temp Xray
config must be set before anything from ``app`` is imported. Nothing here may
touch the real ``db.sqlite3`` or ``xray_config.json``.
"""
import json
import os
import shutil
import subprocess
import sys
import tempfile
from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parent.parent
_TMP = Path(tempfile.mkdtemp(prefix="marzban-tests-"))
DB_FILE = _TMP / "test.sqlite3"
XRAY_FILE = _TMP / "xray_config.json"

XRAY_CONFIG = {
    "log": {"loglevel": "warning"},
    "inbounds": [
        {
            "tag": "VLESS WS",
            "listen": "0.0.0.0",
            "port": 8443,
            "protocol": "vless",
            "settings": {"clients": [], "decryption": "none"},
            "streamSettings": {"network": "ws", "wsSettings": {"path": "/ws"}, "security": "none"},
        },
        {
            "tag": "TROJAN TCP",
            "listen": "0.0.0.0",
            "port": 8444,
            "protocol": "trojan",
            "settings": {"clients": []},
            "streamSettings": {"network": "tcp", "security": "none"},
        },
    ],
    "outbounds": [{"protocol": "freedom", "tag": "DIRECT"}],
}
XRAY_FILE.write_text(json.dumps(XRAY_CONFIG))

os.environ["SQLALCHEMY_DATABASE_URL"] = f"sqlite:///{DB_FILE}"
os.environ["XRAY_JSON"] = str(XRAY_FILE)
os.environ["DEBUG"] = "False"
sys.path.insert(0, str(ROOT))


def run_alembic(*args: str, db_file: Path = DB_FILE) -> subprocess.CompletedProcess:
    env = {**os.environ, "SQLALCHEMY_DATABASE_URL": f"sqlite:///{db_file}", "XRAY_JSON": str(XRAY_FILE)}
    return subprocess.run(
        [sys.executable, "-m", "alembic", *args], cwd=ROOT, env=env, capture_output=True, text=True, check=True
    )


@pytest.fixture(scope="session", autouse=True)
def _cleanup():
    yield
    shutil.rmtree(_TMP, ignore_errors=True)


@pytest.fixture()
def db():
    """A fresh schema per test, created from the ORM models."""
    from app.db import GetDB
    from app.db.base import Base, engine

    from app import xray

    Base.metadata.drop_all(bind=engine)
    Base.metadata.create_all(bind=engine)
    xray.inbound_coefficients.clear()  # process-wide caches must not leak between tests
    xray.hosts.clear()
    with GetDB() as session:
        yield session


@pytest.fixture()
def tmp_db_file(tmp_path) -> Path:
    return tmp_path / "migrate.sqlite3"

"""Shared test fixtures.

After Task 3 (lifespan migration + lazy Xray init + lazy SERVER_IP):

- ``import app`` does ZERO subprocess / HTTP / socket I/O. No
  import-time stubs are required.
- The Xray subsystem (``app.xray.core``, ``.config``, ``.api``) is
  lazily constructed on first attribute access via PEP 562
  ``__getattr__``. Tests that touch ``xray.config`` (e.g. the contract
  tests in ``tests/test_lookups.py``) call ``init_for_tests`` below to
  bootstrap with a real XRayConfig built from the local
  ``xray_config.json`` fixture — no port scan, no subprocess.
- The JWT secret is overridden in-place so no code path reaches the
  module-level ``app.db.base.engine`` for token validation.
"""

import os
import sys

# --- Environment fixups (must run before any `from app import ...`) ---
os.environ.setdefault("SQLALCHEMY_DATABASE_URL", "sqlite:///:memory:")
os.environ.setdefault("XRAY_JSON", "./xray_config.json")
os.environ.setdefault("TELEGRAM_API_TOKEN", "")

# Now safe to import the app and DB layers.
import pytest  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402
from sqlalchemy import create_engine  # noqa: E402
from sqlalchemy.orm import sessionmaker  # noqa: E402

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from app import app as fastapi_app  # noqa: E402
from app import xray as xray_module  # noqa: E402
from app.db import get_db  # noqa: E402
from app.db.base import Base  # noqa: E402
from app.utils import jwt as jwt_utils  # noqa: E402
from app.xray.config import XRayConfig  # noqa: E402

# Bootstrap the lazy Xray subsystem with a config built from the local
# xray_config.json fixture and an explicit api_port — no port scan, no
# subprocess, no network. Tests that monkeypatch xray.config.* (e.g.
# tests/test_lookups.py) read the resulting XRayConfig instance via
# the module __getattr__ added in Task 3.
xray_module.init_for_tests(XRayConfig(os.environ["XRAY_JSON"], api_port=18080))

# Override get_secret_key so tests don't need a JWT row anywhere.
_TEST_JWT_SECRET = "test-jwt-secret-not-for-production"
jwt_utils.get_secret_key.cache_clear()
jwt_utils.get_secret_key = lambda: _TEST_JWT_SECRET  # type: ignore[assignment]


@pytest.fixture(scope="session")
def test_engine():
    """A single in-memory SQLite engine shared by all sessions in a test run.

    ``StaticPool`` + ``check_same_thread=False`` keeps the in-memory database
    alive across the TestClient threadpool boundary.
    """
    from sqlalchemy.pool import StaticPool

    engine = create_engine(
        "sqlite:///:memory:",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    Base.metadata.create_all(engine)
    yield engine
    engine.dispose()


@pytest.fixture
def db_session(test_engine):
    """Yield a transactional session that rolls back on teardown."""
    TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=test_engine)
    session = TestingSessionLocal()
    try:
        yield session
    finally:
        session.rollback()
        session.close()


@pytest.fixture
def client(test_engine):
    """FastAPI TestClient with the ``get_db`` dependency pointed at the
    in-memory engine.
    """
    TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=test_engine)

    def _override_get_db():
        db = TestingSessionLocal()
        try:
            yield db
        finally:
            db.close()

    fastapi_app.dependency_overrides[get_db] = _override_get_db
    try:
        yield TestClient(fastapi_app)
    finally:
        fastapi_app.dependency_overrides.pop(get_db, None)

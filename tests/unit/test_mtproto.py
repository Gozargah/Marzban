from datetime import datetime, timedelta
from types import SimpleNamespace
from unittest.mock import patch

from fastapi import FastAPI
from fastapi.testclient import TestClient

from app.dependencies import get_validated_sub, get_validated_user
from app.models.user import UserStatus
from app.mtproto import (
    build_tg_mtproto_link,
    mtproto_password,
    mtproto_secret,
    render_mtproto_config,
)
from app.routers.subscription import router as subscription_router
from app.routers.user import router as user_router


class _FakeQuery:
    def __init__(self, rows):
        self.rows = rows

    def filter(self, *args, **kwargs):
        return self

    def order_by(self, *args, **kwargs):
        return self

    def all(self):
        return self.rows


class _FakeDB:
    def __init__(self, rows):
        self.rows = rows

    def query(self, *args, **kwargs):
        return _FakeQuery(self.rows)


class _FakeDBContext:
    def __init__(self, rows):
        self.rows = rows

    def __enter__(self):
        return _FakeDB(self.rows)

    def __exit__(self, exc_type, exc, tb):
        return False


class TestMtprotoHelpers:
    def test_password_is_deterministic(self):
        revoked_at = datetime(2026, 3, 27, 12, 0, 0)
        with patch("app.mtproto.get_secret_key", return_value="jwt-secret"):
            first = mtproto_password(1, "alice", revoked_at)
            second = mtproto_password(1, "alice", revoked_at)

        assert first == second
        assert len(first) == 32

    def test_password_changes_after_revoke(self):
        base = datetime(2026, 3, 27, 12, 0, 0)
        with patch("app.mtproto.get_secret_key", return_value="jwt-secret"):
            old = mtproto_password(1, "alice", base)
            new = mtproto_password(1, "alice", base + timedelta(seconds=1))

        assert old != new

    def test_secret_uses_dd_mode_by_default(self):
        with patch("app.mtproto.get_secret_key", return_value="jwt-secret"), patch(
            "app.mtproto.MTPROTO_SECRET_MODE", "dd"
        ):
            secret = mtproto_secret(1, "alice")

        assert secret.startswith("dd")
        assert len(secret) == 34

    def test_secret_uses_ee_mode_with_domain(self):
        with patch("app.mtproto.get_secret_key", return_value="jwt-secret"), patch(
            "app.mtproto.MTPROTO_SECRET_MODE", "ee"
        ), patch(
            "app.mtproto.MTPROTO_TLS_DOMAIN", "cdn.example.com"
        ):
            secret = mtproto_secret(1, "alice")

        assert secret.startswith("ee")
        assert "63646e2e6578616d706c652e636f6d" in secret

    def test_build_tg_link(self):
        link = build_tg_mtproto_link("pool.example.com", 1443, "ddabcdef")
        assert link == (
            "tg://proxy?server=pool.example.com&port=1443&secret=ddabcdef"
        )

    def test_render_config_contains_active_users(self):
        rows = [
            SimpleNamespace(
                id=1,
                username="alice",
                sub_revoked_at=datetime(2026, 3, 27, 12, 0, 0),
            ),
            SimpleNamespace(
                id=2,
                username="bob",
                sub_revoked_at=None,
            ),
        ]

        with patch("app.mtproto.GetDB", return_value=_FakeDBContext(rows)), patch(
            "app.mtproto.MTPROTO_BIND_TO", "0.0.0.0:1443"
        ), patch(
            "app.mtproto.MTPROTO_CONFIG_PATH", "/tmp/mtproto.toml"
        ), patch(
            "app.mtproto.MTPROTO_STATS_BIND_TO", "127.0.0.1:39090"
        ), patch(
            "app.mtproto.MTPROTO_SECRET_MODE", "dd"
        ), patch(
            "app.mtproto.get_secret_key", return_value="jwt-secret"
        ):
            rendered = render_mtproto_config()

        assert 'bind-to = "0.0.0.0:1443"' in rendered
        assert 'api-bind-to = "127.0.0.1:39090"' in rendered
        assert '"alice" = "dd' in rendered
        assert '"bob" = "dd' in rendered
        assert '"__disabled__"' in rendered


class TestMtprotoRouters:
    def _make_client(self, user_obj, sub_obj=None):
        app = FastAPI()
        app.include_router(user_router)
        app.include_router(subscription_router)
        app.dependency_overrides[get_validated_user] = lambda: user_obj
        app.dependency_overrides[get_validated_sub] = lambda: (
            sub_obj if sub_obj is not None else user_obj
        )
        return TestClient(app)

    def test_admin_route_returns_mtproto_config(self):
        user_obj = SimpleNamespace(
            id=10,
            username="alice",
            sub_revoked_at=None,
            status=UserStatus.active,
        )
        client = self._make_client(user_obj)

        with patch("app.routers.user.is_mtproto_enabled", return_value=True), patch(
            "app.routers.user.get_mtproto_public_endpoint",
            return_value=("pool.example.com", 1443),
        ), patch("app.routers.user.mtproto_password", return_value="abc123"), patch(
            "app.routers.user.mtproto_secret", return_value="ddabc123"
        ), patch(
            "app.routers.user.build_tg_mtproto_link",
            return_value="tg://proxy?server=pool.example.com&port=1443&secret=ddabc123",
        ):
            response = client.get("/api/user/alice/mtproto")

        assert response.status_code == 200
        assert response.json() == {
            "host": "pool.example.com",
            "port": 1443,
            "password": "abc123",
            "secret": "ddabc123",
            "tg_link": "tg://proxy?server=pool.example.com&port=1443&secret=ddabc123",
        }

    def test_subscription_route_returns_403_for_inactive_user(self):
        inactive_user = SimpleNamespace(
            id=10,
            username="alice",
            sub_revoked_at=None,
            status=UserStatus.expired,
        )
        client = self._make_client(inactive_user)

        response = client.get("/sub/test-token/mtproto")

        assert response.status_code == 403
        assert response.json()["detail"] == "Subscription is inactive"

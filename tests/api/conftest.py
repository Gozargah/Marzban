from unittest.mock import AsyncMock, MagicMock

import pytest
from aiorwlock import RWLock

from app.db.models import Settings

from . import TestSession, client


@pytest.fixture(autouse=True)
def mock_db_session(monkeypatch: pytest.MonkeyPatch):
    db_session = MagicMock(spec=TestSession)
    monkeypatch.setattr("app.settings.GetDB", db_session)
    return db_session


@pytest.fixture(autouse=True)
def mock_lock(monkeypatch: pytest.MonkeyPatch):
    _lock = MagicMock(spec=RWLock(fast=True))
    monkeypatch.setattr("app.core.manager.core_manager._lock", _lock)
    _lock = MagicMock(spec=RWLock(fast=True))
    monkeypatch.setattr("app.node.node_manager._lock", _lock)


@pytest.fixture(autouse=True)
def mock_settings(monkeypatch: pytest.MonkeyPatch):
    settings = {
        "telegram": {"enable": False, "token": "", "webhook_url": "", "webhook_secret": None, "proxy_url": None},
        "discord": None,
        "webhook": {
            "enable": False,
            "webhooks": [],
            "days_left": [3],
            "usage_percent": [80],
            "timeout": 180,
            "recurrent": 3,
            "proxy_url": None,
        },
        "notification_settings": {
            "notify_telegram": False,
            "notify_discord": False,
            "telegram_api_token": "",
            "telegram_admin_id": None,
            "telegram_channel_id": 0,
            "telegram_topic_id": 0,
            "discord_webhook_url": "",
            "proxy_url": None,
            "max_retries": 3,
        },
        "notification_enable": {
            "admin": True,
            "core": True,
            "group": True,
            "host": True,
            "login": True,
            "node": True,
            "user": True,
            "user_template": True,
            "days_left": True,
            "percentage_reached": True,
        },
        "subscription": {
            "url_prefix": "",
            "update_interval": 12,
            "support_url": "https://t.me/",
            "profile_title": "Subscription",
            "host_status_filter": False,
            "rules": [
                {
                    "pattern": "^([Cc]lash[\\-\\.]?[Vv]erge|[Cc]lash[\\-\\.]?[Mm]eta|[Ff][Ll][Cc]lash|[Mm]ihomo)",
                    "target": "clash_meta",
                },
                {"pattern": "^([Cc]lash|[Ss]tash)", "target": "clash"},
                {
                    "pattern": "^(SFA|SFI|SFM|SFT|[Kk]aring|[Hh]iddify[Nn]ext)|.*[Ss]ing[\\-b]?ox.*",
                    "target": "sing_box",
                },
                {"pattern": "^(SS|SSR|SSD|SSS|Outline|Shadowsocks|SSconf)", "target": "outline"},
                {"pattern": "^v2rayN", "target": "links_base64"},
                {"pattern": "^v2rayNG", "target": "links_base64"},
                {"pattern": "^[Ss]treisand", "target": "links_base64"},
                {"pattern": "^Happ", "target": "links_base64"},
                {"pattern": "^ktor\\-client", "target": "links_base64"},
                {"pattern": "^.*", "target": "links_base64"},
            ],
            "manual_sub_request": {
                "links": True,
                "links_base64": True,
                "xray": True,
                "sing_box": True,
                "clash": True,
                "clash_meta": True,
                "outline": True,
            },
        },
        "general": {"default_flow": "", "default_method": "chacha20-ietf-poly1305"},
    }
    db_settings = Settings(**settings)

    settings_mock = AsyncMock()
    settings_mock.return_value = db_settings

    monkeypatch.setattr("app.settings.get_settings", settings_mock)
    return settings


@pytest.fixture
def access_token() -> str:
    response = client.post(
        url="/api/admin/token",
        data={"username": "testadmin", "password": "testadmin", "grant_type": "password"},
    )
    return response.json()["access_token"]


@pytest.fixture
def disable_cache(monkeypatch: pytest.MonkeyPatch):
    def dummy_cached(*args, **kwargs):
        def wrapper(func):
            return func  # bypass caching

        return wrapper

    monkeypatch.setattr("app.settings.cached", dummy_cached)

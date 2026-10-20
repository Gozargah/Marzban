"""Регистрация устройств в /sub: лимит, ранжирование по first_seen, заглушки и last_ip."""

from __future__ import annotations

import sys
import types
from datetime import datetime, timedelta

import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import Session
from sqlalchemy.pool import StaticPool

for _name, _module in list(sys.modules.items()):
    if _name.startswith("app.") and not hasattr(_module, "__file__") and not hasattr(_module, "__path__"):
        del sys.modules[_name]

_share_stub = types.ModuleType("app.subscription.share")
_share_stub.generate_v2ray_links = lambda *args, **kwargs: []
sys.modules.setdefault("app.subscription.share", _share_stub)

from app.db.base import Base  # noqa: E402
from app.db.crud import (  # noqa: E402
    UNKNOWN_DEVICE_HWID,
    count_user_devices,
    get_user_device_by_hwid,
    is_device_within_limit,
    register_user_device,
)
from app.db.models import User, UserDevice  # noqa: E402
from app.models.user import UserDeviceResponse  # noqa: E402
from app.subscription.user_info import (  # noqa: E402
    get_subscription_user_info,
    resolve_device_limit_subscription_state,
)
from app.utils.client_ip import device_ip, get_client_ip  # noqa: E402

if sys.modules.get("app.subscription.share") is _share_stub:
    del sys.modules["app.subscription.share"]

USER_ID = 1001
BASE_SEEN = datetime(2026, 1, 1, 12, 0, 0)


class FakeSubUser:
    def __init__(self, proxies=None, inbounds=None):
        self.proxies = proxies if proxies is not None else {"vless": {"id": "x"}}
        self.inbounds = inbounds if inbounds is not None else {"vless": ["in"]}

    def model_copy(self, update=None):
        other = FakeSubUser(proxies=dict(self.proxies), inbounds=dict(self.inbounds))
        if update:
            other.proxies = update.get("proxies", other.proxies)
            other.inbounds = update.get("inbounds", other.inbounds)
        return other


@pytest.fixture
def db():
    engine = create_engine("sqlite://", connect_args={"check_same_thread": False}, poolclass=StaticPool)
    Base.metadata.create_all(engine)
    with Session(engine) as session:
        session.add(User(id=USER_ID, username="limit_user", created_at=datetime.utcnow(), device_limit=4))
        session.commit()
        yield session


def _user(db: Session) -> User:
    return db.query(User).filter(User.id == USER_ID).one()


def _add_device(db: Session, hwid: str, *, minutes: int, status: str = "active") -> UserDevice:
    seen = BASE_SEEN + timedelta(minutes=minutes)
    device = UserDevice(
        user_id=USER_ID,
        hwid=hwid,
        status=status,
        first_seen=seen,
        last_seen=seen,
    )
    db.add(device)
    db.commit()
    db.refresh(device)
    return device


def _resolve(db: Session, dbuser: User, hwid: str | None, *, hard_mode: bool):
    user = FakeSubUser()
    return resolve_device_limit_subscription_state(
        user,
        db,
        dbuser,
        False,
        False,
        {"sub_device_limit_hard_mode": hard_mode},
        user_agent="Happ/1.0/Android",
        x_hwid=hwid,
        x_device_os="Android",
        x_ver_os="14",
        x_device_model="Pixel",
    )


def test_is_device_within_limit_first_n_by_first_seen(db):
    devices = [_add_device(db, f"hwid-{i}", minutes=i) for i in range(7)]
    dbuser = _user(db)
    for device in devices[:4]:
        assert is_device_within_limit(db, dbuser, device) is True
    for device in devices[4:]:
        assert is_device_within_limit(db, dbuser, device) is False
    assert is_device_within_limit(db, dbuser, None) is False


def test_is_device_within_limit_without_limit(db):
    dbuser = _user(db)
    dbuser.device_limit = None
    db.commit()
    device = _add_device(db, "hwid-a", minutes=0)
    assert is_device_within_limit(db, dbuser, device) is True
    assert is_device_within_limit(db, dbuser, None) is True


def test_existing_extras_soft_overlay_hard_only(db):
    devices = [_add_device(db, f"hwid-{i}", minutes=i) for i in range(7)]
    dbuser = _user(db)

    in_limit_user, limited, hard, unsupported = _resolve(db, dbuser, devices[0].hwid, hard_mode=False)
    assert (limited, hard, unsupported) == (False, False, False)
    assert in_limit_user.proxies

    extra_soft_user, limited, hard, unsupported = _resolve(db, dbuser, devices[4].hwid, hard_mode=False)
    assert (limited, hard, unsupported) == (True, False, False)
    assert extra_soft_user.proxies

    extra_hard_user, limited, hard, unsupported = _resolve(db, dbuser, devices[6].hwid, hard_mode=True)
    assert (limited, hard, unsupported) == (True, True, False)
    assert extra_hard_user.proxies == {}


def test_exactly_at_limit_known_device_is_clean(db):
    devices = [_add_device(db, f"hwid-{i}", minutes=i) for i in range(4)]
    dbuser = _user(db)
    user, limited, hard, unsupported = _resolve(db, dbuser, devices[3].hwid, hard_mode=True)
    assert (limited, hard, unsupported) == (False, False, False)
    assert user.proxies


def test_new_hwid_at_limit_soft_adds_overlay(db):
    for i in range(4):
        _add_device(db, f"hwid-{i}", minutes=i)
    dbuser = _user(db)
    user, limited, hard, unsupported = _resolve(db, dbuser, "hwid-new", hard_mode=False)
    assert (limited, hard, unsupported) == (True, False, False)
    assert user.proxies
    assert count_user_devices(db, dbuser) == 5
    assert get_user_device_by_hwid(db, dbuser, "hwid-new") is not None


def test_new_hwid_at_limit_hard_does_not_add(db):
    for i in range(4):
        _add_device(db, f"hwid-{i}", minutes=i)
    dbuser = _user(db)
    user, limited, hard, unsupported = _resolve(db, dbuser, "hwid-new", hard_mode=True)
    assert (limited, hard, unsupported) == (True, True, False)
    assert user.proxies == {}
    assert count_user_devices(db, dbuser) == 4
    assert get_user_device_by_hwid(db, dbuser, "hwid-new") is None


def test_no_device_limit_adds_and_not_limited(db):
    dbuser = _user(db)
    dbuser.device_limit = None
    db.commit()
    user, limited, hard, unsupported = _resolve(db, dbuser, "hwid-new", hard_mode=True)
    assert (limited, hard, unsupported) == (False, False, False)
    assert user.proxies
    assert get_user_device_by_hwid(db, dbuser, "hwid-new") is not None


def test_register_soft_allows_over_limit_hard_blocks(db):
    dbuser = _user(db)
    for i in range(4):
        _add_device(db, f"hwid-{i}", minutes=i)

    registered, unsupported = register_user_device(db, dbuser, "soft-new", None, None, None, "Happ", hard_mode=False)
    assert (registered, unsupported) == (True, False)
    assert get_user_device_by_hwid(db, dbuser, "soft-new") is not None

    registered, unsupported = register_user_device(db, dbuser, "hard-new", None, None, None, "Happ", hard_mode=True)
    assert (registered, unsupported) == (False, False)
    assert get_user_device_by_hwid(db, dbuser, "hard-new") is None


def test_unknown_hwid_constant_used_for_empty_header(db):
    dbuser = _user(db)
    registered, unsupported = register_user_device(db, dbuser, None, None, None, None, "Happ/1.0", hard_mode=False)
    assert (registered, unsupported) == (True, False)
    assert get_user_device_by_hwid(db, dbuser, UNKNOWN_DEVICE_HWID) is not None


def test_subscription_user_info_uses_regular_traffic():
    user = types.SimpleNamespace(used_traffic=50, data_limit=1000, expire=123)

    info = get_subscription_user_info(user)

    assert info == {"upload": 0, "download": 50, "total": 1000, "expire": 123}


def test_subscription_user_info_total_is_zero_without_data_limit():
    user = types.SimpleNamespace(used_traffic=50, data_limit=None, expire=0)

    info = get_subscription_user_info(user)

    assert info["download"] == 50
    assert info["total"] == 0


# --- NPVPN-2148: last_ip устройства ---

NODE_ADDRESSES = {"191.10.23.12"}


def _register(
    db: Session, hwid: str | None, client_ip: str | None, *, user_agent: str = "Happ/1.0", hard_mode: bool = False
):
    return register_user_device(
        db, _user(db), hwid, None, None, None, user_agent, hard_mode=hard_mode, client_ip=client_ip
    )


def test_new_device_stores_client_ip(db):
    _register(db, "hwid-ip", "8.8.8.8")
    assert get_user_device_by_hwid(db, _user(db), "hwid-ip").last_ip == "8.8.8.8"


def test_known_device_updates_client_ip(db):
    _register(db, "hwid-ip", "8.8.8.8")
    _register(db, "hwid-ip", "1.1.1.1")
    assert get_user_device_by_hwid(db, _user(db), "hwid-ip").last_ip == "1.1.1.1"


def test_none_client_ip_keeps_previous(db):
    _register(db, "hwid-ip", "8.8.8.8")
    _register(db, "hwid-ip", None)
    assert get_user_device_by_hwid(db, _user(db), "hwid-ip").last_ip == "8.8.8.8"


def test_unknown_device_stores_and_updates_client_ip(db):
    _register(db, None, "8.8.8.8")
    _register(db, None, "1.1.1.1")
    assert get_user_device_by_hwid(db, _user(db), UNKNOWN_DEVICE_HWID).last_ip == "1.1.1.1"


def test_rejected_unknown_device_keeps_ip(db):
    # unknown-устройство с другим user-agent отклоняется — IP не трогаем.
    _register(db, None, "8.8.8.8", user_agent="Happ/1.0")
    registered, unsupported = _register(db, None, "1.1.1.1", user_agent="v2rayNG/1.8")
    assert (registered, unsupported) == (False, True)
    assert get_user_device_by_hwid(db, _user(db), UNKNOWN_DEVICE_HWID).last_ip == "8.8.8.8"


def test_hard_mode_blocked_device_is_not_created(db):
    # hard-mode отклонил новое устройство — строки с IP нет.
    for i in range(4):
        _add_device(db, f"hwid-{i}", minutes=i)
    registered, _ = _register(db, "hwid-blocked", "8.8.8.8", hard_mode=True)
    assert registered is False
    assert get_user_device_by_hwid(db, _user(db), "hwid-blocked") is None


def _resolve_with_ip(db: Session, hwid: str, client_ip: str | None, *, is_expired: bool = False):
    return resolve_device_limit_subscription_state(
        FakeSubUser(),
        db,
        _user(db),
        False,
        is_expired,
        {},
        user_agent="Happ/1.0/Android",
        x_hwid=hwid,
        x_device_os="Android",
        x_ver_os="14",
        x_device_model="Pixel",
        client_ip=client_ip,
    )


def _sub_request_ip(forwarded_for: str) -> str | None:
    """Та же композиция, что в build_render_context, без поднятия роутера."""
    request = types.SimpleNamespace(
        headers={"X-Forwarded-For": forwarded_for}, client=types.SimpleNamespace(host="172.18.0.5")
    )
    return device_ip(get_client_ip(request), NODE_ADDRESSES)


def test_sub_request_ip_reaches_device(db):
    _resolve_with_ip(db, "hwid-sub", _sub_request_ip("8.8.8.8"))
    assert get_user_device_by_hwid(db, _user(db), "hwid-sub").last_ip == "8.8.8.8"


def test_sub_request_through_node_keeps_previous_ip(db):
    _resolve_with_ip(db, "hwid-sub", _sub_request_ip("8.8.8.8"))
    _resolve_with_ip(db, "hwid-sub", _sub_request_ip("191.10.23.12"))
    assert get_user_device_by_hwid(db, _user(db), "hwid-sub").last_ip == "8.8.8.8"


def test_expired_subscription_does_not_register_ip(db):
    # у истёкшей подписки регистрации нет — и IP не пишется.
    _resolve_with_ip(db, "hwid-expired", "8.8.8.8", is_expired=True)
    assert get_user_device_by_hwid(db, _user(db), "hwid-expired") is None


def test_device_response_exposes_last_ip(db):
    # старое устройство без IP отдаётся с last_ip=None.
    old = _add_device(db, "hwid-old", minutes=0)
    _register(db, "hwid-new", "8.8.8.8")
    assert UserDeviceResponse.model_validate(old).last_ip is None
    new = get_user_device_by_hwid(db, _user(db), "hwid-new")
    assert UserDeviceResponse.model_validate(new).last_ip == "8.8.8.8"

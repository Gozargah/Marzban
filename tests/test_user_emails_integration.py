"""Emails sent to Xray must match the ones the usage job parses."""
import pytest

from app import xray
from app.db import crud
from app.db.models import JWT, Proxy, User
from app.models.proxy import ProxyTypes
from app.models.user import UserStatus
from app.xray import operations
from app.xray.emails import split_stat_name


def make_user(db, username="bob", status=UserStatus.active):
    if not db.query(JWT).first():
        db.add(JWT())  # subscription urls are signed with this secret
    user = User(username=username, status=status)
    db.add(user)
    db.flush()
    db.add(Proxy(user_id=user.id, type=ProxyTypes.VLESS, settings={"id": "11111111-1111-1111-1111-111111111111"}))
    db.add(Proxy(user_id=user.id, type=ProxyTypes.Trojan, settings={"password": "pw"}))
    db.commit()
    return user


def clients(config, tag):
    return {c["email"] for c in config.get_inbound(tag)["settings"]["clients"]}


def test_startup_config_uses_plain_email_by_default(db):
    user = make_user(db)
    config = xray.config.include_db_users()
    assert clients(config, "VLESS WS") == {f"{user.id}.bob"}
    assert clients(config, "TROJAN TCP") == {f"{user.id}.bob"}


def test_startup_config_uses_inbound_email_for_non_default_coefficient(db):
    user = make_user(db)
    crud.set_inbound_coefficient(db, "VLESS WS", 2.0)
    config = xray.config.include_db_users()
    assert clients(config, "VLESS WS") == {f"{user.id}.bob@VLESS WS"}
    assert clients(config, "TROJAN TCP") == {f"{user.id}.bob"}
    # and the usage job can map it back to the user and inbound
    assert split_stat_name(f"{user.id}.bob@VLESS WS") == (str(user.id), "VLESS WS")


def test_inactive_users_are_not_added(db):
    make_user(db, "gone", UserStatus.disabled)
    assert clients(xray.config.include_db_users(), "VLESS WS") == set()


@pytest.fixture()
def calls(monkeypatch):
    log = []
    monkeypatch.setattr(operations, "_remove_user_from_inbound", lambda api, tag, email: log.append(("rm", tag, email)))
    monkeypatch.setattr(xray, "nodes", {})
    return log


def test_remove_user_clears_both_email_variants(db, calls):
    user = make_user(db)
    operations.remove_user(user)
    for tag in ("VLESS WS", "TROJAN TCP"):
        assert ("rm", tag, f"{user.id}.bob") in calls
        assert ("rm", tag, f"{user.id}.bob@{tag}") in calls


def test_update_user_removes_stale_variant_after_coefficient_change(db, calls, monkeypatch):
    user = make_user(db)
    crud.set_inbound_coefficient(db, "VLESS WS", 2.0)
    xray.inbound_coefficients.update()
    altered = []
    monkeypatch.setattr(operations, "_alter_inbound_user", lambda api, tag, account: altered.append((tag, account.email)))
    operations.update_user(db.get(User, user.id))
    assert ("VLESS WS", f"{user.id}.bob@VLESS WS") in altered
    assert ("rm", "VLESS WS", f"{user.id}.bob") in calls  # old plain email dropped
    assert ("rm", "VLESS WS", f"{user.id}.bob@VLESS WS") not in calls

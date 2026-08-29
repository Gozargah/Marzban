"""The user half of app/db/crud.py.

These are the queries every screen of the panel sits on top of, and the place
where a user silently ends up with the wrong status or the wrong owner.
"""

from datetime import datetime, timedelta

import pytest
from sqlalchemy.exc import IntegrityError

from app.db import crud
from app.db.models import User
from app.models.user import (UserCreate, UserDataLimitResetStrategy, UserModify,
                             UserStatus)

from conftest import new_user

GIGABYTE = 1024 ** 3


def create(db, username, **overrides):
    admin = overrides.pop("admin", None)
    return crud.create_user(db, new_user(username, **overrides), admin=admin)


class TestCreateUser:
    def test_defaults_to_an_active_user_with_no_limits(self, db):
        user = create(db, "alice")

        assert user.username == "alice"
        assert user.status == UserStatus.active
        assert user.used_traffic == 0
        assert user.data_limit is None
        assert user.expire is None

    def test_zero_limits_are_stored_as_no_limit(self, db):
        user = create(db, "alice", data_limit=0, expire=0)

        assert user.data_limit is None
        assert user.expire is None

    def test_proxies_are_persisted_with_generated_settings(self, db):
        user = create(db, "alice", proxies={"vmess": {}, "trojan": {}})
        settings = {proxy.type: proxy.settings for proxy in user.proxies}

        assert set(settings) == {"vmess", "trojan"}
        assert settings["vmess"]["id"]  # a uuid was generated
        assert settings["trojan"]["password"]

    def test_inbounds_default_to_every_tag_of_the_protocol(self, db):
        user = create(db, "alice", proxies={"vmess": {}})

        assert user.inbounds == {"vmess": ["VMESS TCP"]}
        assert user.excluded_inbounds == {"vmess": []}

    def test_a_protocol_omitted_from_inbounds_still_gets_all_its_tags(self, db):
        """Listing tags for one protocol does not narrow the others.

        The validator fills in every tag for any protocol it finds in
        `proxies` but not in `inbounds`, so leaving vless out enables it
        rather than disabling it.
        """
        user = crud.create_user(
            db,
            UserCreate(
                username="alice",
                proxies={"vmess": {}, "vless": {}},
                inbounds={"vmess": ["VMESS TCP"]},
            ),
        )

        assert user.inbounds["vmess"] == ["VMESS TCP"]
        assert user.inbounds["vless"] == ["VLESS WS"]

    def test_an_unknown_inbound_tag_is_rejected(self, db):
        with pytest.raises(ValueError):
            UserCreate(username="alice", proxies={"vmess": {}}, inbounds={"vmess": ["NOPE"]})

    def test_an_empty_tag_list_means_every_tag_not_none(self, db):
        """`{"vmess": []}` enables all vmess inbounds rather than disabling them.

        Pinned down because it reads the other way round: the validator treats
        an empty list the same as an absent one.
        """
        user = crud.create_user(
            db,
            UserCreate(username="alice", proxies={"vmess": {}}, inbounds={"vmess": []}),
        )

        assert user.inbounds["vmess"] == ["VMESS TCP"]

    def test_a_second_user_with_the_same_name_is_rejected(self, db):
        create(db, "alice")

        with pytest.raises(IntegrityError):
            create(db, "alice")

    def test_the_creating_admin_owns_the_user(self, db, plain_admin):
        user = create(db, "alice", admin=plain_admin)

        assert user.admin.username == "reseller"

    def test_on_hold_needs_a_duration(self):
        with pytest.raises(ValueError):
            new_user("alice", status="on_hold")

    def test_on_hold_and_expire_are_mutually_exclusive(self):
        with pytest.raises(ValueError):
            new_user("alice", status="on_hold", on_hold_expire_duration=3600, expire=2000000000)

    @pytest.mark.parametrize("username", ["ab", "a" * 33, "no spaces", "bad!chars"])
    def test_invalid_usernames_are_rejected(self, username):
        with pytest.raises(ValueError):
            new_user(username)


class TestGetUsers:
    @pytest.fixture
    def population(self, db, sudo_admin, plain_admin):
        create(db, "alice", admin=sudo_admin, note="first customer")
        create(db, "bob", admin=plain_admin)
        carol = create(db, "carol", admin=plain_admin)
        carol.status = UserStatus.disabled
        db.commit()
        return db

    def test_search_matches_the_username(self, population, db):
        assert [u.username for u in crud.get_users(db, search="ali")] == ["alice"]

    def test_search_also_matches_the_note(self, population, db):
        assert [u.username for u in crud.get_users(db, search="customer")] == ["alice"]

    def test_filter_by_a_single_status(self, population, db):
        found = crud.get_users(db, status=UserStatus.disabled)

        assert [u.username for u in found] == ["carol"]

    def test_filter_by_several_statuses(self, population, db):
        found = crud.get_users(db, status=[UserStatus.active, UserStatus.disabled])

        assert len(found) == 3

    def test_filter_by_owning_admin(self, population, db, plain_admin):
        found = crud.get_users(db, admin=plain_admin)

        assert {u.username for u in found} == {"bob", "carol"}

    def test_filter_by_admin_username(self, population, db):
        found = crud.get_users(db, admins=["reseller"])

        assert {u.username for u in found} == {"bob", "carol"}

    def test_filter_by_usernames(self, population, db):
        found = crud.get_users(db, usernames=["alice", "carol"])

        assert {u.username for u in found} == {"alice", "carol"}

    def test_sorting_descending(self, population, db):
        sort = [crud.UsersSortingOptions["-username"]]

        assert [u.username for u in crud.get_users(db, sort=sort)] == ["carol", "bob", "alice"]

    def test_pagination(self, population, db):
        sort = [crud.UsersSortingOptions["username"]]

        assert [u.username for u in crud.get_users(db, sort=sort, offset=1, limit=1)] == ["bob"]

    def test_the_count_ignores_pagination(self, population, db):
        users, total = crud.get_users(db, limit=1, return_with_count=True)

        assert len(users) == 1
        assert total == 3

    def test_count_by_status_and_admin(self, population, db, plain_admin):
        assert crud.get_users_count(db) == 3
        assert crud.get_users_count(db, status=UserStatus.disabled) == 1
        assert crud.get_users_count(db, admin=plain_admin) == 2


class TestUpdateUser:
    def test_a_limit_below_the_used_traffic_limits_the_user(self, db):
        user = create(db, "alice", data_limit=10 * GIGABYTE)
        user.used_traffic = 5 * GIGABYTE
        db.commit()

        crud.update_user(db, user, UserModify(data_limit=GIGABYTE))

        assert user.status == UserStatus.limited

    def test_raising_the_limit_reactivates_a_limited_user(self, db):
        user = create(db, "alice", data_limit=GIGABYTE)
        user.used_traffic = 5 * GIGABYTE
        user.status = UserStatus.limited
        db.commit()

        crud.update_user(db, user, UserModify(data_limit=10 * GIGABYTE))

        assert user.status == UserStatus.active

    def test_a_past_expiry_expires_the_user(self, db):
        user = create(db, "alice")
        past = int((datetime.utcnow() - timedelta(days=1)).timestamp())

        crud.update_user(db, user, UserModify(expire=past))

        assert user.status == UserStatus.expired

    def test_a_future_expiry_reactivates_an_expired_user(self, db):
        user = create(db, "alice")
        user.status = UserStatus.expired
        db.commit()
        future = int((datetime.utcnow() + timedelta(days=30)).timestamp())

        crud.update_user(db, user, UserModify(expire=future))

        assert user.status == UserStatus.active

    def test_a_disabled_user_is_not_reactivated_by_a_new_limit(self, db):
        user = create(db, "alice")
        user.status = UserStatus.disabled
        db.commit()

        crud.update_user(db, user, UserModify(data_limit=10 * GIGABYTE))

        assert user.status == UserStatus.disabled

    def test_an_empty_note_clears_the_note(self, db):
        user = create(db, "alice", note="something")

        crud.update_user(db, user, UserModify(note=""))

        assert user.note is None

    def test_omitted_fields_are_left_alone(self, db):
        user = create(db, "alice", data_limit=GIGABYTE, note="keep me")

        crud.update_user(db, user, UserModify(status="disabled"))

        assert user.data_limit == GIGABYTE
        assert user.note == "keep me"

    def test_a_protocol_missing_from_the_update_is_removed(self, db):
        user = create(db, "alice", proxies={"vmess": {}, "trojan": {}})

        crud.update_user(db, user, UserModify(proxies={"vmess": {}}))

        assert [proxy.type for proxy in user.proxies] == ["vmess"]

    def test_changing_inbounds_rewrites_the_exclusions(self, db):
        user = create(db, "alice", proxies={"vmess": {}, "vless": {}})

        crud.update_user(db, user, UserModify(inbounds={"vless": []}))

        assert user.inbounds["vless"] == []
        assert user.excluded_inbounds["vless"] == ["VLESS WS"]

    def test_the_reset_strategy_can_be_changed(self, db):
        user = create(db, "alice")

        crud.update_user(db, user, UserModify(data_limit_reset_strategy="month"))

        assert user.data_limit_reset_strategy == UserDataLimitResetStrategy.month

    def test_an_update_stamps_edit_at(self, db):
        user = create(db, "alice")
        assert user.edit_at is None

        crud.update_user(db, user, UserModify(note="touched"))

        assert user.edit_at is not None


class TestResetUsage:
    def test_usage_is_zeroed_and_logged(self, db):
        user = create(db, "alice")
        user.used_traffic = 7 * GIGABYTE
        db.commit()

        crud.reset_user_data_usage(db, user)

        assert user.used_traffic == 0
        assert [log.used_traffic_at_reset for log in user.usage_logs] == [7 * GIGABYTE]

    def test_lifetime_usage_survives_the_reset(self, db):
        user = create(db, "alice")
        user.used_traffic = 7 * GIGABYTE
        db.commit()
        crud.reset_user_data_usage(db, user)
        user.used_traffic = GIGABYTE
        db.commit()

        assert user.lifetime_used_traffic == 8 * GIGABYTE

    def test_a_limited_user_becomes_active_again(self, db):
        user = create(db, "alice", data_limit=GIGABYTE)
        user.status = UserStatus.limited
        db.commit()

        crud.reset_user_data_usage(db, user)

        assert user.status == UserStatus.active

    @pytest.mark.parametrize("status", [UserStatus.expired, UserStatus.disabled])
    def test_expired_and_disabled_users_keep_their_status(self, db, status):
        user = create(db, "alice")
        user.status = status
        db.commit()

        crud.reset_user_data_usage(db, user)

        assert user.status == status


class TestRevokeSubscription:
    def test_the_proxy_credentials_change(self, db):
        user = create(db, "alice", proxies={"vmess": {}, "trojan": {}})
        before = {proxy.type: dict(proxy.settings) for proxy in user.proxies}

        crud.revoke_user_sub(db, user)

        after = {proxy.type: proxy.settings for proxy in user.proxies}
        assert after["vmess"]["id"] != before["vmess"]["id"]
        assert after["trojan"]["password"] != before["trojan"]["password"]

    def test_the_revocation_is_stamped(self, db):
        user = create(db, "alice")
        assert user.sub_revoked_at is None

        crud.revoke_user_sub(db, user)

        assert user.sub_revoked_at is not None


class TestAutodelete:
    def _expired(self, db, username, days_ago, auto_delete_in_days=None):
        user = create(db, username)
        user.status = UserStatus.expired
        user.last_status_change = datetime.utcnow() - timedelta(days=days_ago)
        user.auto_delete_in_days = auto_delete_in_days
        db.commit()
        return user

    def test_a_user_past_its_own_window_is_deleted(self, db):
        self._expired(db, "alice", days_ago=5, auto_delete_in_days=3)

        assert [u.username for u in crud.autodelete_expired_users(db)] == ["alice"]
        assert crud.get_user(db, "alice") is None

    def test_a_user_inside_its_window_is_kept(self, db):
        self._expired(db, "alice", days_ago=1, auto_delete_in_days=3)

        assert crud.autodelete_expired_users(db) == []
        assert crud.get_user(db, "alice") is not None

    def test_a_negative_window_never_deletes(self, db):
        self._expired(db, "alice", days_ago=400, auto_delete_in_days=-1)

        assert crud.autodelete_expired_users(db) == []

    def test_users_without_a_window_fall_back_to_the_global_setting(self, db, monkeypatch):
        monkeypatch.setattr(crud, "USERS_AUTODELETE_DAYS", 2)
        self._expired(db, "alice", days_ago=5)

        assert [u.username for u in crud.autodelete_expired_users(db)] == ["alice"]

    def test_the_global_default_of_never_keeps_everyone(self, db):
        # USERS_AUTODELETE_DAYS defaults to -1, which disables autodeletion.
        self._expired(db, "alice", days_ago=400)

        assert crud.autodelete_expired_users(db) == []

    def test_limited_users_are_only_deleted_when_asked_for(self, db):
        user = create(db, "alice")
        user.status = UserStatus.limited
        user.last_status_change = datetime.utcnow() - timedelta(days=10)
        user.auto_delete_in_days = 1
        db.commit()

        assert crud.autodelete_expired_users(db) == []
        assert [u.username for u in crud.autodelete_expired_users(db, include_limited_users=True)] == ["alice"]


class TestRemoveUser:
    def test_removing_a_user_takes_its_proxies_with_it(self, db):
        from app.db.models import Proxy

        create(db, "alice", proxies={"vmess": {}, "trojan": {}})
        assert db.query(Proxy).count() == 2

        crud.remove_user(db, crud.get_user(db, "alice"))

        assert db.query(User).count() == 0
        assert db.query(Proxy).count() == 0

    def test_removing_several_users_at_once(self, db):
        create(db, "alice")
        create(db, "bob")

        crud.remove_users(db, crud.get_users(db))

        assert crud.get_users_count(db) == 0


class TestOwnership:
    def test_set_owner_moves_a_user_between_admins(self, db, sudo_admin, plain_admin):
        user = create(db, "alice", admin=sudo_admin)

        crud.set_owner(db, user, plain_admin)

        assert user.admin.username == "reseller"

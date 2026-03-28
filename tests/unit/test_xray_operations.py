import importlib.util
import sys
from datetime import datetime
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import MagicMock, patch

from app.routers.core import restart_core
from app.jobs.review_users import review
from app.models.user import UserStatus


def _fake_dbuser(status=UserStatus.active, sub_revoked_at=None):
    return SimpleNamespace(
        id=1,
        username="alice",
        status=status,
        sub_revoked_at=sub_revoked_at,
    )


def _load_real_operations_module():
    module_name = "tests_real_xray_operations"
    if module_name in sys.modules:
        return sys.modules[module_name]

    account_mod = sys.modules["xray_api.types.account"]
    if not hasattr(account_mod, "SocksAccount"):
        account_mod.SocksAccount = MagicMock
    if not hasattr(account_mod, "Account"):
        account_mod.Account = MagicMock

    operations_path = Path(__file__).resolve().parents[2] / "app" / "xray" / "operations.py"
    spec = importlib.util.spec_from_file_location(module_name, operations_path)
    module = importlib.util.module_from_spec(spec)
    assert spec and spec.loader
    sys.modules[module_name] = module
    spec.loader.exec_module(module)
    return module


class TestXrayOperations:
    def test_sync_socks_on_add_updates_active_user(self):
        operations = _load_real_operations_module()
        dbuser = _fake_dbuser()

        with patch.object(
            operations.xray.config,
            "socks_inbounds_by_tag",
            {"SOCKS5_INBOUND": {"tag": "SOCKS5_INBOUND"}},
        ), patch(f"{operations.__name__}._apply_socks_add") as apply_socks_add:
            changed = operations._sync_socks_on_add(dbuser)

        assert changed is True
        apply_socks_add.assert_called_once()

    def test_sync_socks_on_update_alters_when_password_changes(self):
        operations = _load_real_operations_module()
        current = _fake_dbuser(sub_revoked_at=datetime(2026, 3, 28, 12, 0, 1))
        previous = operations.UserSyncState(
            user_id=1,
            username="alice",
            status=UserStatus.active,
            sub_revoked_at=datetime(2026, 3, 28, 12, 0, 0),
        )

        with patch.object(
            operations.xray.config,
            "socks_inbounds_by_tag",
            {"SOCKS5_INBOUND": {"tag": "SOCKS5_INBOUND"}},
        ), patch(f"{operations.__name__}._apply_socks_alter") as apply_socks_alter:
            changed = operations._sync_socks_on_update(current, previous_sync_state=previous)

        assert changed is True
        apply_socks_alter.assert_called_once()

    def test_review_syncs_mtproto_after_status_updates(self):
        active_user = _fake_dbuser()
        active_user.used_traffic = 10
        active_user.data_limit = 10
        active_user.expire = None
        active_user.admin = None
        active_user.next_plan = None

        events = []

        with patch("app.jobs.review_users.GetDB") as get_db, patch(
            "app.jobs.review_users.get_users",
            side_effect=[[active_user], []],
        ), patch(
            "app.jobs.review_users.xray.operations.remove_user",
            side_effect=lambda *args, **kwargs: events.append("remove"),
        ) as remove_user, patch(
            "app.jobs.review_users.update_user_status",
            side_effect=lambda *args, **kwargs: events.append("status"),
        ), patch(
            "app.jobs.review_users.report.status_change"
        ), patch(
            "app.jobs.review_users.UserResponse.model_validate",
            return_value=SimpleNamespace(),
        ), patch(
            "app.jobs.review_users.logger.info"
        ), patch(
            "app.jobs.review_users.sync_mtproto_node",
            side_effect=lambda: events.append("mtproto"),
        ) as sync_mtproto:
            get_db.return_value.__enter__ = MagicMock(return_value=MagicMock())
            get_db.return_value.__exit__ = MagicMock(return_value=False)
            review()

        remove_user.assert_called_once()
        assert remove_user.call_args.kwargs["sync_mtproto"] is False
        sync_mtproto.assert_called_once()
        assert events == ["remove", "status", "mtproto"]

    def test_restart_core_route_uses_restart_all_cores_helper(self):
        with patch("app.routers.core.xray.operations.restart_all_cores") as restart_all_cores:
            response = restart_core(admin=object())

        assert response == {}
        restart_all_cores.assert_called_once_with()

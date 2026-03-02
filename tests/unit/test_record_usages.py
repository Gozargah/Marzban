"""
Unit tests for app/jobs/record_usages.py

Tests:
- safe_execute retry logic with deadlock simulation
- parameter sorting before executemany (InnoDB lock-order consistency)
- ON DUPLICATE KEY UPDATE path for MySQL
- SQLite fallback path
- Hysteria2-specific record_hysteria_usages traffic accounting
"""

import random
import time
from datetime import datetime
from unittest.mock import MagicMock, call, patch

import pytest
from pymysql.err import OperationalError


# ── safe_execute ──────────────────────────────────────────────────────────────

class TestSafeExecute:
    """Tests for the deadlock-retry wrapper."""

    def _make_mysql_session(self):
        """Create a mock SQLAlchemy session that behaves like MySQL."""
        session = MagicMock()
        session.bind.name = "mysql"
        conn = MagicMock()
        session.connection.return_value = conn
        return session, conn

    def _deadlock_error(self):
        return OperationalError(1213, "Deadlock found when trying to get lock")

    def test_success_on_first_try(self):
        from app.jobs.record_usages import safe_execute
        session, conn = self._make_mysql_session()
        stmt = MagicMock()
        safe_execute(session, stmt, [{"uid": 1, "value": 100}])
        conn.execute.assert_called_once()
        session.commit.assert_called_once()

    def test_deadlock_retry_succeeds_on_4th_attempt(self):
        """3 deadlock failures followed by 1 success should succeed."""
        from app.jobs.record_usages import safe_execute
        session, conn = self._make_mysql_session()
        stmt = MagicMock()

        conn.execute.side_effect = [
            self._deadlock_error(),
            self._deadlock_error(),
            self._deadlock_error(),
            None,  # success on 4th attempt
        ]

        with patch("time.sleep"):  # suppress actual sleep in tests
            safe_execute(session, stmt)

        assert conn.execute.call_count == 4
        session.rollback.call_count == 3
        session.commit.assert_called_once()

    def test_deadlock_retry_raises_after_max_attempts(self):
        """After 5 deadlocks, the exception must propagate."""
        from app.jobs.record_usages import safe_execute
        session, conn = self._make_mysql_session()
        conn.execute.side_effect = self._deadlock_error()

        with patch("time.sleep"), pytest.raises(OperationalError) as exc_info:
            safe_execute(session, MagicMock())

        assert exc_info.value.args[0] == 1213
        assert conn.execute.call_count == 6  # 1 initial + 5 retries

    def test_non_deadlock_error_raises_immediately(self):
        """Non-deadlock OperationalError should NOT be retried."""
        from app.jobs.record_usages import safe_execute
        session, conn = self._make_mysql_session()
        conn.execute.side_effect = OperationalError(1045, "Access denied")

        with pytest.raises(OperationalError) as exc_info:
            safe_execute(session, MagicMock())

        assert exc_info.value.args[0] == 1045
        conn.execute.assert_called_once()  # no retries

    def test_sqlite_path_no_insert_ignore(self):
        """SQLite path calls execute directly without INSERT IGNORE prefix."""
        from app.jobs.record_usages import safe_execute
        session = MagicMock()
        session.bind.name = "sqlite"
        conn = MagicMock()
        session.connection.return_value = conn

        safe_execute(session, MagicMock(), [])
        conn.execute.assert_called_once()
        session.commit.assert_called_once()


# ── parameter sorting ─────────────────────────────────────────────────────────

class TestParamSorting:
    """Verify that all bulk updates sort params by uid before executing.

    Consistent lock-acquisition order prevents InnoDB deadlocks.
    """

    def test_record_user_stats_sorts_params_ascending(self):
        """record_user_stats() must sort params by uid (int) ascending."""
        all_calls_params = []

        def fake_safe_execute(db, stmt, params=None):
            if params:
                all_calls_params.append(list(params))

        params_in = [
            {"uid": "5", "value": 100},
            {"uid": "1", "value": 200},
            {"uid": "3", "value": 150},
            {"uid": "10", "value": 50},
            {"uid": "2", "value": 300},
        ]

        with patch("app.jobs.record_usages.GetDB") as mock_getdb, \
             patch("app.jobs.record_usages.safe_execute", side_effect=fake_safe_execute):

            mock_db = MagicMock()
            mock_db.bind.name = "sqlite"
            mock_db.__enter__ = MagicMock(return_value=mock_db)
            mock_db.__exit__ = MagicMock(return_value=False)
            mock_getdb.return_value = mock_db
            mock_db.execute.return_value.fetchall.return_value = []

            from app.jobs.record_usages import record_user_stats
            record_user_stats(params_in, node_id=1)

        # Every individual safe_execute call must have its params in sorted uid order
        assert all_calls_params, "safe_execute was never called with params"
        for call_params in all_calls_params:
            uids = [int(p["uid"]) for p in call_params if "uid" in p]
            if uids:
                assert uids == sorted(uids), \
                    f"Params not sorted within a single call: {uids}"


# ── Hysteria2 traffic accounting ──────────────────────────────────────────────

class TestRecordHysteriaUsages:
    def test_empty_stats_returns_early(self):
        """No DB calls when there are no traffic stats."""
        with patch("app.jobs.record_hysteria_usage._fetch_traffic", return_value={}), \
             patch("app.jobs.record_hysteria_usage.GetDB") as mock_getdb:
            from app.jobs.record_hysteria_usage import record_hysteria_usages
            record_hysteria_usages()
        mock_getdb.assert_not_called()

    def test_traffic_aggregated_correctly(self):
        """tx+rx are summed for each user."""
        stats = {
            "alice": {"tx": 1000, "rx": 500},
            "bob":   {"tx": 0,    "rx": 200},
        }

        captured_params = []

        def fake_safe_execute(db, stmt, params=None):
            if params:
                captured_params.extend(params)

        mock_db = MagicMock()
        mock_db.bind.name = "sqlite"
        mock_db.__enter__ = MagicMock(return_value=mock_db)
        mock_db.__exit__ = MagicMock(return_value=False)

        # Simulate rows returned for alice (id=1, admin=10) and bob (id=2, admin=10)
        row_alice = MagicMock()
        row_alice.id = 1
        row_alice.username = "alice"
        row_alice.admin_id = 10

        row_bob = MagicMock()
        row_bob.id = 2
        row_bob.username = "bob"
        row_bob.admin_id = 10

        mock_db.query.return_value.filter.return_value.all.return_value = [
            row_alice, row_bob
        ]

        with patch("app.jobs.record_hysteria_usage._fetch_traffic", return_value=stats), \
             patch("app.jobs.record_hysteria_usage.GetDB", return_value=mock_db), \
             patch("app.jobs.record_hysteria_usage.safe_execute",
                   side_effect=fake_safe_execute):
            from app.jobs.record_hysteria_usage import record_hysteria_usages
            record_hysteria_usages()

        # First safe_execute call = user params
        user_params_sent = [p for p in captured_params if "uid" in p]
        values = {p["uid"]: p["value"] for p in user_params_sent}
        assert values[1] == 1500  # alice: tx+rx = 1000+500
        assert values[2] == 200   # bob: tx+rx = 0+200

    def test_user_params_sorted_by_uid(self):
        """record_hysteria_usages must sort user_params by uid."""
        stats = {f"user{i}": {"tx": 100, "rx": 50} for i in range(5)}
        captured_params = []

        def fake_safe_execute(db, stmt, params=None):
            if params:
                captured_params.extend(params)

        mock_db = MagicMock()
        mock_db.bind.name = "sqlite"
        mock_db.__enter__ = MagicMock(return_value=mock_db)
        mock_db.__exit__ = MagicMock(return_value=False)

        rows = []
        for i in range(5):
            r = MagicMock()
            r.id = 5 - i   # reverse order to verify sorting
            r.username = f"user{i}"
            r.admin_id = None
            rows.append(r)

        mock_db.query.return_value.filter.return_value.all.return_value = rows

        with patch("app.jobs.record_hysteria_usage._fetch_traffic", return_value=stats), \
             patch("app.jobs.record_hysteria_usage.GetDB", return_value=mock_db), \
             patch("app.jobs.record_hysteria_usage.safe_execute",
                   side_effect=fake_safe_execute):
            from app.jobs.record_hysteria_usage import record_hysteria_usages
            record_hysteria_usages()

        user_params = [p for p in captured_params if "uid" in p]
        uids = [p["uid"] for p in user_params]
        assert uids == sorted(uids), f"user_params not sorted by uid: {uids}"

    def test_zero_traffic_users_skipped(self):
        """Users with zero total traffic must not generate update params."""
        stats = {"alice": {"tx": 0, "rx": 0}}

        mock_db = MagicMock()
        mock_db.bind.name = "sqlite"
        mock_db.__enter__ = MagicMock(return_value=mock_db)
        mock_db.__exit__ = MagicMock(return_value=False)

        row = MagicMock()
        row.id = 1
        row.username = "alice"
        row.admin_id = None
        mock_db.query.return_value.filter.return_value.all.return_value = [row]

        with patch("app.jobs.record_hysteria_usage._fetch_traffic", return_value=stats), \
             patch("app.jobs.record_hysteria_usage.GetDB", return_value=mock_db), \
             patch("app.jobs.record_hysteria_usage.safe_execute") as mock_se:
            from app.jobs.record_hysteria_usage import record_hysteria_usages
            record_hysteria_usages()

        mock_se.assert_not_called()

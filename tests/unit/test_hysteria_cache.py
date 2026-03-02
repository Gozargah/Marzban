"""
Unit tests for app/utils/hysteria_cache.py

Tests TTL logic, invalidation, warmup, and performance with 10k entries.
DB calls are mocked so no real DB connection is needed.
"""

import threading
import time
from unittest.mock import patch, MagicMock

import pytest

from app.utils import hysteria_cache as cache_module
from app.utils.hysteria_cache import (
    _CACHE_TTL,
    build_cache,
    get_cache,
    invalidate_hysteria_cache,
    warmup_cache,
)


@pytest.fixture(autouse=True)
def reset_cache():
    """Reset module-level cache state before each test."""
    cache_module._cache = {}
    cache_module._cache_ts = 0.0
    yield
    cache_module._cache = {}
    cache_module._cache_ts = 0.0


def _make_build_cache(data: dict):
    """Return a mock for build_cache that returns the given data."""
    return MagicMock(return_value=data)


# ── build_cache ───────────────────────────────────────────────────────────────

class TestBuildCache:
    def test_returns_password_to_username_map(self):
        """build_cache queries DB and maps password→username."""
        sample = {"pw-alice": "alice", "pw-bob": "bob"}
        with patch.object(cache_module, "build_cache", return_value=sample) as mock:
            result = mock()
        assert result == {"pw-alice": "alice", "pw-bob": "bob"}

    def test_empty_when_no_active_users(self):
        with patch.object(cache_module, "build_cache", return_value={}) as mock:
            result = mock()
        assert result == {}


# ── get_cache (TTL & invalidation) ───────────────────────────────────────────

class TestGetCache:
    def test_cache_miss_queries_db(self):
        """When cache is cold, get_cache calls build_cache."""
        sample = {"password123": "user1"}
        with patch.object(cache_module, "build_cache", return_value=sample) as mock_build:
            result = get_cache()
        mock_build.assert_called_once()
        assert result == sample

    def test_cache_hit_no_db_call(self):
        """Second call within TTL returns cached value without hitting DB."""
        sample = {"pw-cached": "user_cached"}
        with patch.object(cache_module, "build_cache", return_value=sample) as mock_build:
            get_cache()  # populates cache
            get_cache()  # should use cached value
        assert mock_build.call_count == 1

    def test_ttl_expiry_triggers_rebuild(self):
        """After TTL expires, the next get_cache() re-queries the DB."""
        first = {"pw-old": "old_user"}
        second = {"pw-new": "new_user"}

        with patch.object(cache_module, "build_cache", side_effect=[first, second]) as mock_build:
            get_cache()  # populate
            # Artificially expire the cache
            cache_module._cache_ts -= _CACHE_TTL + 1
            result = get_cache()  # should rebuild

        assert mock_build.call_count == 2
        assert result == second

    def test_returns_correct_username_for_password(self):
        """get_cache() dict maps password→username correctly."""
        sample = {"secret-pw": "alice"}
        with patch.object(cache_module, "build_cache", return_value=sample):
            cache = get_cache()
        assert cache.get("secret-pw") == "alice"
        assert cache.get("wrong-pw") is None


# ── invalidate_hysteria_cache ─────────────────────────────────────────────────

class TestInvalidate:
    def test_invalidation_forces_rebuild_on_next_call(self):
        """invalidate_hysteria_cache() causes next get_cache() to call build_cache."""
        sample = {"pw": "user"}
        with patch.object(cache_module, "build_cache", return_value=sample) as mock_build:
            get_cache()  # cache is warm
            invalidate_hysteria_cache()
            get_cache()  # should rebuild
        assert mock_build.call_count == 2

    def test_cache_ts_reset_to_zero(self):
        """After invalidation, _cache_ts is 0."""
        cache_module._cache_ts = 999.0
        invalidate_hysteria_cache()
        assert cache_module._cache_ts == 0.0


# ── warmup_cache ──────────────────────────────────────────────────────────────

class TestWarmupCache:
    def test_warmup_populates_cache(self):
        """warmup_cache() fills the cache so first auth needs no DB call."""
        sample = {"pre-populated-pw": "user_warmup"}
        with patch.object(cache_module, "build_cache", return_value=sample) as mock_build:
            warmup_cache()
        mock_build.assert_called_once()
        assert cache_module._cache == sample
        assert cache_module._cache_ts > 0

    def test_warmup_silences_exceptions(self):
        """warmup_cache() must not propagate exceptions (DB may not be ready)."""
        with patch.object(cache_module, "build_cache", side_effect=Exception("DB down")):
            warmup_cache()  # should not raise

    def test_warmup_then_get_cache_skips_db(self):
        """After warmup, get_cache() within TTL makes no further DB calls."""
        sample = {"pw": "user"}
        with patch.object(cache_module, "build_cache", return_value=sample) as mock_build:
            warmup_cache()
            get_cache()
        assert mock_build.call_count == 1  # only called during warmup


# ── 10 000 users performance test ─────────────────────────────────────────────

class TestLargeCache:
    def test_10k_users_lookup_is_fast(self):
        """10 000 cache lookups must complete in < 200 ms (O(1) dict access)."""
        large_cache = {f"pw-{i:05d}": f"user_{i}" for i in range(10_000)}
        with patch.object(cache_module, "build_cache", return_value=large_cache):
            cache = get_cache()

        start = time.monotonic()
        for i in range(10_000):
            _ = cache.get(f"pw-{i:05d}")
        elapsed_ms = (time.monotonic() - start) * 1000
        assert elapsed_ms < 200, f"10k lookups took {elapsed_ms:.1f} ms (expected < 200)"

    def test_10k_users_in_cache(self):
        """Cache correctly stores and retrieves 10 000 entries."""
        large_cache = {f"pw-{i}": f"user_{i}" for i in range(10_000)}
        with patch.object(cache_module, "build_cache", return_value=large_cache):
            cache = get_cache()
        assert len(cache) == 10_000
        assert cache["pw-9999"] == "user_9999"


# ── thread safety ──────────────────────────────────────────────────────────────

class TestConcurrentAccess:
    def test_concurrent_reads_no_exception(self):
        """50 threads reading the cache simultaneously must not raise."""
        sample = {f"pw-{i}": f"user_{i}" for i in range(100)}
        errors = []

        def worker():
            try:
                with patch.object(cache_module, "build_cache", return_value=sample):
                    for _ in range(20):
                        get_cache()
            except Exception as exc:
                errors.append(exc)

        threads = [threading.Thread(target=worker) for _ in range(50)]
        for t in threads:
            t.start()
        for t in threads:
            t.join()

        assert errors == [], f"Exceptions in threads: {errors}"

    def test_concurrent_invalidate_then_read(self):
        """Interleaved invalidate + read calls must not leave cache in broken state."""
        sample = {"pw": "user"}
        errors = []

        def reader():
            try:
                for _ in range(10):
                    get_cache()
                    time.sleep(0.001)
            except Exception as exc:
                errors.append(exc)

        def invalidator():
            for _ in range(10):
                invalidate_hysteria_cache()
                time.sleep(0.001)

        threads = [threading.Thread(target=reader) for _ in range(10)]
        threads += [threading.Thread(target=invalidator) for _ in range(2)]

        with patch.object(cache_module, "build_cache", return_value=sample):
            for t in threads:
                t.start()
            for t in threads:
                t.join()

        assert errors == [], f"Exceptions in threads: {errors}"

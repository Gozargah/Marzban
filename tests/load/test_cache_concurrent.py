"""
Load / concurrency tests for the Hysteria2 in-memory cache.

Verifies that the cache is race-condition-free under heavy concurrent access:
  - 100 threads reading simultaneously
  - Interleaved invalidations while reading
  - 10 000 entries in cache (memory + lookup speed)
"""

import threading
import time
from unittest.mock import patch

import pytest

from app.utils import hysteria_cache as cache_module
from app.utils.hysteria_cache import (
    get_cache,
    invalidate_hysteria_cache,
    warmup_cache,
)

LARGE_CACHE_SIZE = 10_000
NUM_READER_THREADS = 100
READS_PER_THREAD = 20


@pytest.fixture(autouse=True)
def reset_cache():
    cache_module._cache = {}
    cache_module._cache_ts = 0.0
    yield
    cache_module._cache = {}
    cache_module._cache_ts = 0.0


def _build_large_cache():
    """Simulated build_cache returning 10 000 entries."""
    return {f"pw-{i:05d}": f"user_{i}" for i in range(LARGE_CACHE_SIZE)}


# ── 100 concurrent readers × 10k entries ──────────────────────────────────────

class TestConcurrentReads:

    def test_100_threads_no_exception(self):
        """100 threads reading the cache simultaneously must not raise."""
        errors = []
        large = _build_large_cache()

        def worker():
            try:
                for _ in range(READS_PER_THREAD):
                    cache = get_cache()
                    assert cache.get("pw-00001") == "user_1"
            except Exception as exc:
                errors.append(exc)

        threads = [threading.Thread(target=worker) for _ in range(NUM_READER_THREADS)]
        with patch.object(cache_module, "build_cache", return_value=large):
            for t in threads:
                t.start()
            for t in threads:
                t.join(timeout=30)

        assert all(not t.is_alive() for t in threads), "Some threads did not finish"
        assert errors == [], f"{len(errors)} thread(s) raised exceptions: {errors[:3]}"

    def test_cache_size_stays_consistent_under_concurrent_access(self):
        """Under concurrent reads, cache size remains 10 000."""
        sizes = []
        large = _build_large_cache()

        def reader():
            for _ in range(5):
                sizes.append(len(get_cache()))

        threads = [threading.Thread(target=reader) for _ in range(50)]
        with patch.object(cache_module, "build_cache", return_value=large):
            get_cache()  # warm up
            for t in threads:
                t.start()
            for t in threads:
                t.join()

        assert all(s == LARGE_CACHE_SIZE for s in sizes), \
            f"Inconsistent cache sizes observed: {set(sizes)}"


# ── concurrent reads + invalidations ─────────────────────────────────────────

class TestConcurrentInvalidate:

    def test_interleaved_invalidate_and_read_no_race(self):
        """
        50 reader threads + 5 invalidator threads running simultaneously.
        No exceptions, no data corruption, no deadlocks.

        The patch is applied at the test level (not inside threads) to avoid
        race conditions in unittest.mock's patch/unpatch mechanism.
        """
        errors = []
        read_results = []
        large = _build_large_cache()

        def reader():
            try:
                for _ in range(20):
                    cache = get_cache()
                    result = cache.get("pw-00500")
                    read_results.append(result)
                    time.sleep(0.0005)
            except Exception as exc:
                errors.append(exc)

        def invalidator():
            for _ in range(10):
                invalidate_hysteria_cache()
                time.sleep(0.001)

        threads = [threading.Thread(target=reader) for _ in range(50)]
        threads += [threading.Thread(target=invalidator) for _ in range(5)]

        with patch.object(cache_module, "build_cache", return_value=large):
            for t in threads:
                t.start()
            for t in threads:
                t.join(timeout=30)

        assert all(not t.is_alive() for t in threads), "Some threads did not finish"
        assert errors == [], f"Thread exceptions: {errors[:3]}"

        correct_results = [r for r in read_results if r is not None]
        assert all(r == "user_500" for r in correct_results), \
            f"Incorrect cache values observed: {set(correct_results)}"


# ── warmup under concurrent access ────────────────────────────────────────────

class TestWarmupConcurrent:

    def test_concurrent_warmup_and_reads_no_crash(self):
        """Simultaneous warmup + reads must not crash."""
        errors = []
        large = _build_large_cache()

        def do_warmup():
            try:
                warmup_cache()
            except Exception as exc:
                errors.append(exc)

        def do_read():
            try:
                for _ in range(5):
                    get_cache()
            except Exception as exc:
                errors.append(exc)

        threads = ([threading.Thread(target=do_warmup) for _ in range(5)]
                   + [threading.Thread(target=do_read) for _ in range(20)])

        with patch.object(cache_module, "build_cache", return_value=large):
            for t in threads:
                t.start()
            for t in threads:
                t.join(timeout=15)

        assert errors == [], f"Exceptions: {errors[:3]}"


# ── timing benchmark ──────────────────────────────────────────────────────────

class TestCacheTiming:

    def test_10k_lookups_under_50ms(self):
        """
        10 000 sequential cache lookups on a 10k-entry warm cache
        must complete in under 50 ms (Python dict access is O(1)).
        """
        large = _build_large_cache()
        with patch.object(cache_module, "build_cache", return_value=large):
            cache = get_cache()

        start = time.perf_counter()
        for i in range(LARGE_CACHE_SIZE):
            _ = cache.get(f"pw-{i:05d}")
        elapsed_ms = (time.perf_counter() - start) * 1_000

        assert elapsed_ms < 50, (
            f"10k lookups took {elapsed_ms:.1f} ms — dict access too slow"
        )

    def test_cache_rebuild_10k_entries_under_1s(self):
        """
        Rebuilding cache from 10 000 rows must complete in under 1 second
        (even with simulated DB latency of 50 ms).
        """
        large = _build_large_cache()

        def _slow_build():
            time.sleep(0.05)  # simulate 50 ms DB query
            return large

        invalidate_hysteria_cache()
        start = time.perf_counter()
        with patch.object(cache_module, "build_cache", side_effect=_slow_build):
            cache = get_cache()
        elapsed = time.perf_counter() - start

        assert len(cache) == LARGE_CACHE_SIZE
        assert elapsed < 1.0, f"Cache rebuild took {elapsed:.2f}s"

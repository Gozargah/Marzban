import pytest

from app.utils.rate_limit import SlidingWindowRateLimiter


@pytest.fixture
def clock(monkeypatch):
    """A controllable replacement for time.monotonic."""
    class Clock:
        now = 1000.0

        def tick(self, seconds):
            self.now += seconds

    c = Clock()
    monkeypatch.setattr("app.utils.rate_limit.time.monotonic", lambda: c.now)
    return c


@pytest.fixture
def limiter():
    return SlidingWindowRateLimiter(attempts=3, window=60)


class TestBlocking:
    def test_allows_attempts_below_the_limit(self, limiter, clock):
        for _ in range(2):
            limiter.record_failure("1.2.3.4")

        assert limiter.retry_after("1.2.3.4") == 0

    def test_blocks_once_the_limit_is_reached(self, limiter, clock):
        for _ in range(3):
            limiter.record_failure("1.2.3.4")

        assert limiter.retry_after("1.2.3.4") > 0

    def test_retry_after_never_exceeds_the_window(self, limiter, clock):
        for _ in range(10):
            limiter.record_failure("1.2.3.4")

        assert 0 < limiter.retry_after("1.2.3.4") <= limiter.window + 1

    def test_other_clients_are_unaffected(self, limiter, clock):
        for _ in range(5):
            limiter.record_failure("1.2.3.4")

        assert limiter.retry_after("5.6.7.8") == 0


class TestWindowSliding:
    def test_unblocks_after_the_window_passes(self, limiter, clock):
        for _ in range(3):
            limiter.record_failure("1.2.3.4")
        clock.tick(61)

        assert limiter.retry_after("1.2.3.4") == 0

    def test_failures_spread_wider_than_the_window_never_block(self, limiter, clock):
        for _ in range(10):
            limiter.record_failure("1.2.3.4")
            clock.tick(31)

        assert limiter.retry_after("1.2.3.4") == 0

    def test_stale_keys_are_dropped(self, limiter, clock):
        limiter.record_failure("1.2.3.4")
        clock.tick(61)
        limiter.record_failure("5.6.7.8")

        assert "1.2.3.4" not in limiter._hits


class TestKeyCap:
    def test_the_number_of_tracked_keys_is_bounded(self, clock):
        """Part of a login key is the username, which the caller chooses."""
        limiter = SlidingWindowRateLimiter(attempts=3, window=60, max_keys=10)

        for index in range(200):
            limiter.record_failure(f"1.2.3.4\nuser{index}")

        assert len(limiter._hits) == 10

    def test_the_key_just_seen_survives_the_eviction(self, clock):
        limiter = SlidingWindowRateLimiter(attempts=3, window=60, max_keys=2)

        for index in range(50):
            limiter.record_failure(f"1.2.3.4\nuser{index}")

        assert "1.2.3.4\nuser49" in limiter._hits

    def test_a_blocked_key_is_not_evicted_by_junk(self, clock):
        """Filling the dict must not be a way to clear someone else's block."""
        limiter = SlidingWindowRateLimiter(attempts=3, window=60, max_keys=3)
        for _ in range(3):
            limiter.record_failure("1.2.3.4\nroot")
            clock.tick(1)

        for index in range(50):
            limiter.record_failure(f"5.6.7.8\nuser{index}")

        assert limiter.retry_after("1.2.3.4\nroot") > 0


class TestReset:
    def test_success_clears_the_counter(self, limiter, clock):
        for _ in range(3):
            limiter.record_failure("1.2.3.4")
        limiter.reset("1.2.3.4")

        assert limiter.retry_after("1.2.3.4") == 0


class TestDisabled:
    @pytest.mark.parametrize("attempts,window", [(0, 60), (5, 0), (-1, 60)])
    def test_zero_attempts_or_window_disables_limiting(self, attempts, window, clock):
        limiter = SlidingWindowRateLimiter(attempts=attempts, window=window)
        for _ in range(100):
            limiter.record_failure("1.2.3.4")

        assert limiter.enabled is False
        assert limiter.retry_after("1.2.3.4") == 0

"""A small in-memory rate limiter used to slow down credential brute-force.

The panel runs with a single uvicorn worker (see main.py), so keeping the
state in the process is enough and avoids pulling in another dependency.
Sync endpoints are served from a threadpool, hence the lock.
"""

import time
from collections import defaultdict, deque
from threading import Lock
from typing import Deque, Dict


class SlidingWindowRateLimiter:
    """Counts events per key within a sliding time window.

    Only failures are recorded; a successful attempt clears the key, so a
    legitimate user is never penalised for someone else's typos.
    """

    def __init__(self, attempts: int, window: int, max_keys: int = 4096):
        self.attempts = attempts
        self.window = window
        # Part of a key is chosen by whoever is knocking — the login endpoint
        # counts per (address, username) — so a flood of made-up names must
        # not grow this dict without end.
        self.max_keys = max_keys
        self._hits: Dict[str, Deque[float]] = defaultdict(deque)
        self._lock = Lock()

    @property
    def enabled(self) -> bool:
        return self.attempts > 0 and self.window > 0

    def _prune(self, hits: Deque[float], now: float) -> None:
        cutoff = now - self.window
        while hits and hits[0] <= cutoff:
            hits.popleft()

    def retry_after(self, key: str) -> int:
        """Seconds to wait before `key` is allowed again, 0 when it is allowed."""
        if not self.enabled:
            return 0

        now = time.monotonic()
        with self._lock:
            hits = self._hits.get(key)
            if not hits:
                return 0

            self._prune(hits, now)
            if not hits:
                del self._hits[key]
                return 0

            if len(hits) < self.attempts:
                return 0

            return max(1, int(self.window - (now - hits[0])) + 1)

    def record_failure(self, key: str) -> None:
        if not self.enabled:
            return

        now = time.monotonic()
        with self._lock:
            hits = self._hits[key]
            self._prune(hits, now)
            hits.append(now)

            # Keep the dict from growing without bound on a noisy public host.
            for stale_key in [k for k, v in self._hits.items() if v and v[-1] <= now - self.window]:
                del self._hits[stale_key]

            self._evict(key)

    def _evict(self, keep: str) -> None:
        """Drop keys once the cap is passed, least useful ones first.

        Called with the lock held. What gets dropped matters as much as the cap
        itself: evicting a key that is currently blocking would turn "fill the
        dict with junk" into a way of clearing someone else's block, so keys
        already at the limit go last and the key just recorded is never
        dropped at all.
        """
        excess = len(self._hits) - self.max_keys
        if excess <= 0:
            return

        def priority(item):
            hits = item[1]
            return len(hits) >= self.attempts, hits[-1] if hits else 0

        for stale_key, _ in sorted(self._hits.items(), key=priority):
            if excess <= 0:
                break
            if stale_key == keep:
                continue
            del self._hits[stale_key]
            excess -= 1

    def reset(self, key: str) -> None:
        with self._lock:
            self._hits.pop(key, None)

    def clear(self) -> None:
        with self._lock:
            self._hits.clear()

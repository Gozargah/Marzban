# Changelog

All notable changes to this fork are recorded here.

The format is loosely based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/);
this project does not strictly follow SemVer because compatibility with the
upstream Marzban API surface takes precedence.

## v0.9.0 (unreleased)

The v0.9.0 release is a stability-focused refresh. See
`docs/V0.9.0_DECISIONS.md` for the full scope and rationale and
`docs/CODEBASE_MAP.md` for the codebase survey that drove it.

### Fixed
- **Dockerfile build stage `setuptools` pin (`<81`).** Task 1 pinned
  `setuptools<81` in `requirements-dev.txt` and in the
  `.github/workflows/ci.yml` lint-and-test bootstrap, but missed the
  Dockerfile, which still ran `pip install --upgrade pip setuptools`
  with no upper bound. setuptools 81 removed `pkg_resources`, and
  APScheduler 3.9.1 imports it at module load — so the production
  image build broke at the final stage's `marzban-cli completion
  install` step with `ModuleNotFoundError: No module named
  'pkg_resources'`. The Dockerfile build stage now matches the CI
  bootstrap (`pip install --upgrade pip 'setuptools<81' wheel`).
  Same root cause as the Task 1 CI fix, in a second place that fix
  missed.
- **`docker-build` CI job** added to `.github/workflows/ci.yml` so
  "CI green" actually includes "the image builds". Runs in parallel
  with lint-and-test so fast feedback is unaffected.

### Task 3 — Reliability infrastructure

#### Changed
- **Lifespan migration.** Replaced the four `@app.on_event("startup")`
  and three `@app.on_event("shutdown")` handlers spread across
  `app/__init__.py`, `app/dashboard/__init__.py`,
  `app/jobs/0_xray_core.py`, `app/jobs/send_notifications.py`, and
  `app/telegram/__init__.py` with a single async `lifespan` context
  manager passed to `FastAPI(lifespan=...)`. The previous
  registration / reverse-registration order is preserved exactly. The
  `app/jobs/0_xray_core.py` filename was renamed to
  `app/jobs/xray_core.py` — the `0_` prefix only existed to force first-
  position registration of `@app.on_event` handlers; lifespan controls
  ordering explicitly so the prefix is no longer needed.
- **`import app` now performs zero subprocess / network / socket I/O.**
  Three import-time side effects were deferred:
  - `XRayCore.__init__`'s `xray version` subprocess call → now a
    `functools.cached_property version` (first read does the
    subprocess once).
  - `app/subscription/share.py:27-28` `SERVER_IP = get_public_ip()` /
    `SERVER_IPV6 = get_public_ipv6()` (up to ~15 s of outbound HTTP at
    import) → now `lru_cache`'d `get_server_ip()` /
    `get_server_ipv6()` helpers, called on demand from
    `setup_format_variables`.
  - The free-port scan + `XRayConfig` parse in `app/xray/__init__.py`
    → deferred via a module-level `__getattr__` (PEP 562). `xray.core`,
    `xray.config`, and `xray.api` are constructed on first attribute
    access; `init_for_tests(config)` lets test conftests bootstrap
    without a port scan.
  - `tests/conftest.py` dropped all three import-time stubs
    (`subprocess.check_output`, `requests.get`, `socket.socket.connect`)
    and the dual-engine workaround for the JWT secret. A new
    `tests/test_import_isolation.py` forks a fresh interpreter with
    each of those calls blocked and asserts `import app` succeeds —
    locking the invariant in CI.

#### Changed (behaviour)
- **Node connect/restart failures now log at ERROR with traceback.**
  `app/xray/operations.py` previously logged `logger.info("Unable to
  connect to X node")` with no exception text (the real error only
  landed in `Node.message`). Both sites are now
  `logger.error(..., exc_info=True)` so the full traceback is in the
  log. Other INFO lifecycle logs are unchanged. (`CODEBASE_MAP §6.3`,
  `V0.9.0_DECISIONS Q8`.)

#### Added
- **`LOG_FORMAT` env var** (default `text`, opt-in `json`). When set
  to `json`, the new `app/utils/log_setup.JsonFormatter` emits
  one-JSON-object-per-line with `ts/level/logger/msg/module/func/line`,
  any `extra={...}` keys, and an `exc_info` traceback block when
  present. Stdlib-only — no new dependency. `text` (default) preserves
  uvicorn's current human-readable format.

#### Deprecated
- **rpyc node transport.** When a node connects via rpyc
  (`RPyCXRayNode`), the panel logs a one-shot `DEPRECATED` warning per
  process. rpyc support stays in v0.9.x; removal is targeted for
  **v1.0**. See [`docs/migrating-from-rpyc.md`](docs/migrating-from-rpyc.md)
  for the (node-side, panel-transparent) migration procedure to the
  REST/uvicorn agent.

#### Notes
- `tests/conftest.py` dual-engine workaround (creating tables on
  `app.db.base.engine` in addition to the per-test engine) is now
  retired. `app.utils.jwt.get_secret_key` is overridden in conftest to
  return a static test secret, removing the only code path that
  reached the global engine.

### Task 2 — Decouple `app/db/models` and `app/models/*` from `app/xray`

#### Changed
- **Refactored `app/db/models.py`, `app/models/user.py`, and
  `app/models/user_template.py`** to look up inbound metadata through a
  new `InboundLookup` abstraction in `app/db/lookups.py` instead of
  importing `app/xray` directly. The default `XrayConfigLookup`
  proxies to `app.xray.config` with lazy imports inside each method —
  importing `app.db.lookups` no longer triggers Xray subsystem
  initialisation. **No production behaviour change.**
- Enables tests to inject a fake lookup (`set_lookup(...)` /
  `reset_lookup()`), unblocking isolated unit testing of DB models
  and Pydantic validators. Tracked under `V0.9.0_DECISIONS.md` Q7 and
  `CODEBASE_MAP.md` §6.8.
- Discovery during Task 2 found that `app/models/user_template.py` had
  the same coupling pattern as `app/db/models.py` and `app/models/user.py`,
  though it was not enumerated in `CODEBASE_MAP §6.8`. It is included
  in this refactor so the decoupling is complete.

#### Notes
- The `tests/conftest.py` dual-engine workaround (creating tables on
  the global `app.db.base.engine` in addition to the per-test engine)
  is **retained**. Discovery confirmed it exists for code paths that
  reach the module-level `GetDB()` context manager — e.g.
  `app.utils.jwt.get_secret_key()` reading the JWT secret table — and
  is orthogonal to the model ↔ xray coupling. Removing it cleanly
  belongs to Task 3 (lifespan migration), which will rework the
  global-engine pattern as a whole.
- The conftest import-time stubs for `subprocess.check_output`,
  `requests.get`, and `socket.socket.connect` are also retained for
  the same reason: `import app.models.user` still transitively loads
  `app.xray` (via `app.subscription.share`, which itself imports xray
  and runs `get_public_ip()` at import). Cutting that chain belongs to
  Task 3.

### Task 1 — Foundation

#### Added
- **Test infrastructure.** `pytest` + `pytest-asyncio` + `pytest-mock` +
  `httpx` + `ruff` under `requirements-dev.txt`. New `pyproject.toml`
  configures pytest (`testpaths=["tests"]`, `asyncio_mode="auto"`) and ruff
  (`line-length=100`, target Python 3.12, sensible `E/F/I/B` rule set with
  pervasive legacy categories silenced and tracked in `CODEBASE_MAP §6`).
- **`tests/` scaffolding** with shared fixtures (`db_session`, `client`)
  backed by SQLite in-memory and a `TestClient` whose `get_db` is
  overridden to the test session. Smoke tests: app imports, public
  endpoint responds, DB session fixture works.
- **GitHub Actions CI** (`.github/workflows/ci.yml`): on push and PR,
  Python 3.12, installs `requirements.txt` + `requirements-dev.txt`, runs
  `ruff check .`, runs `pytest -v`, with pip caching.
- **`DEVELOPING.md`** (and a README pointer): local dev setup, how to run
  tests and lint, how to reproduce CI checks locally.
- Regression tests for the `usage_coefficient` create bug and the JWT
  bare-except tightening.

#### Changed
- **Xray binary is now pinned** at `v26.2.6` via a vendored
  `scripts/install_xray.sh` (replaces the build-time `curl … |  bash` of
  upstream `install_latest_xray.sh`, which silently tracked latest).
  `Dockerfile` exposes `ARG XRAY_VERSION` so rebuilds are deterministic;
  override with `docker build --build-arg XRAY_VERSION=vX.Y.Z`.
  `scripts/install_latest_xray.sh` is retained as a **deprecated** symlink
  to the new script and will be removed in v1.0.
- **`main.py` now enforces single-worker startup**: if `UVICORN_WORKERS`
  env or `--workers` CLI is set to `>1`, the process logs a clear error
  explaining the in-process singleton constraints (APScheduler, XRayCore,
  XRayAPI, the `nodes` map) and exits with code 1. Multi-worker support
  is a v1.0+ goal (`V0.9.0_DECISIONS.md` Q11).

#### Fixed
- **CI install path on a clean Python 3.12 runner.** APScheduler 3.9.1
  imports `pkg_resources` at module import time; a clean Python 3.12
  environment ships pip but no setuptools, so the import fails with
  `ModuleNotFoundError: No module named 'pkg_resources'`. Pinned
  `setuptools<81` in `requirements-dev.txt` (setuptools 81 dropped the
  `pkg_resources` shim) and added an explicit pip/setuptools/wheel
  bootstrap step to `.github/workflows/ci.yml`. Decision: pin setuptools
  rather than bump APScheduler to 3.10+, because Task 1 is strictly
  additive and bumping APScheduler is a behavior surface that belongs in
  a later release. Removing the setuptools pin will be revisited when
  APScheduler is upgraded.
- **`app/jobs/review_users.py:add_notification_reminders`** —
  `now: datetime = datetime.utcnow()` was evaluated once at module import,
  so every later call that omitted `now` saw the frozen import-time
  timestamp instead of "now". Default to `None`, resolve at call time.
- **`app/db/crud.py:create_node`** — `usage_coefficient` from the
  `NodeCreate` payload was dropped and every new node got the DB default
  `1.0` regardless of admin input. Now persisted on creation. Regression
  test added (`tests/test_crud_node.py`).
- **`app/utils/jwt.py:get_subscription_payload`** — the bare `except:`
  around the token base64-decode block now catches only
  `(binascii.Error, UnicodeDecodeError)`. Behavior for invalid tokens is
  unchanged (still returns `None`); unrelated programmer errors are no
  longer masked. Tracked under `CODEBASE_MAP §6.5`.

### Deprecated (notice only — removal targeted for v1.0)
- `scripts/install_latest_xray.sh` (use `scripts/install_xray.sh --version`).

### Upgrade notes
- No DB migration changes. No subscription URL changes. No config-file
  changes. Drop-in upgrade from 0.8.4.
- If your image build relied on `install_latest_xray.sh` being fetched from
  the upstream Gozargah/Marzban-scripts repo, you can either keep that
  external dependency (the symlink keeps the old name working locally) or
  pin a specific version via `--build-arg XRAY_VERSION=vX.Y.Z`.
- If you previously started uvicorn with `--workers N` where `N > 1`, the
  process will refuse to start. Drop the flag — multi-worker was never
  supported (see the pre-existing comment at `main.py:48-49`).

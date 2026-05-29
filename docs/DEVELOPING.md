# Developing this fork

Quickstart for contributors. For architectural background, read
[`CODEBASE_MAP.md`](CODEBASE_MAP.md); for the v0.9.0 release plan and
locked scope decisions, read [`V0.9.0_DECISIONS.md`](V0.9.0_DECISIONS.md).

## Prerequisites

- Python **3.12** (matches the Dockerfile and the `target-version` in
  `pyproject.toml`).
- A C toolchain for building the few sdist-only deps (`build-essential`
  on Debian/Ubuntu).
- (Optional) The Xray binary — only required at runtime. Tests stub it
  out, so you do not need it installed to run `pytest`.

## Setup

```bash
git clone <your-fork-url> darzban
cd darzban

python3.12 -m venv .venv
source .venv/bin/activate

pip install --upgrade pip setuptools wheel
pip install -r requirements.txt -r requirements-dev.txt
```

## Running tests

```bash
pytest -v
```

Tests run against an in-memory SQLite database. The test session also
stubs out `subprocess.check_output` for the Xray binary invocation and
`requests.get` / `socket.socket.connect` for the module-level
`get_public_ip()` call. See `tests/conftest.py` for the full setup.

Fixtures available in tests:

- `db_session` — a transactional `Session` against the shared in-memory
  engine; rolls back on teardown.
- `client` — a `fastapi.testclient.TestClient` with the `get_db`
  dependency overridden to the test session.

## Lint

```bash
ruff check .
```

Configuration lives under `[tool.ruff]` in `pyproject.toml`. The
selected rule set is `E/F/I/B` with several legacy categories silenced —
see the comment block in `pyproject.toml` for the rationale. Each
ignored category is tracked in `docs/CODEBASE_MAP.md` §6 and will be
addressed case-by-case across the v0.9.0 work; please don't bulk-fix
legacy occurrences in unrelated PRs.

## Reproducing CI locally

CI (`.github/workflows/ci.yml`) runs exactly these two checks on
Python 3.12:

```bash
ruff check .
pytest -v
```

If both pass locally, CI will pass.

## Running the app

```bash
# Required: a DATABASE URL (defaults to ./db.sqlite3) and SSL or
# UVICORN_UDS for non-localhost access. See .env.example.
python main.py
```

Single-worker is enforced — setting `UVICORN_WORKERS>1` or
`--workers N` (N>1) will cause `main.py` to log an error and exit. See
`docs/V0.9.0_DECISIONS.md` Q11.

## Branch / commit conventions

- Develop on `feat/<short-name>` or `fix/<short-name>` branches off
  `master`.
- Logical commits (one concern per commit). Each commit must pass
  `ruff check` and `pytest`.
- Reference the relevant section of `docs/CODEBASE_MAP.md` or
  `docs/V0.9.0_DECISIONS.md` in the commit body when fixing or changing
  flagged behavior.

## Pinning the Xray binary at build time

```bash
docker build --build-arg XRAY_VERSION=v26.2.6 -t marzban .
# or
XRAY_VERSION=v26.2.6 bash scripts/install_xray.sh
```

The default version is kept in sync between `Dockerfile` (the
`XRAY_VERSION` `ARG`) and `scripts/install_xray.sh` (`DEFAULT_VERSION`).

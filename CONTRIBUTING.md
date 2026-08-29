# Contributing to Xenith

Thanks for considering contributing to Xenith!

Xenith is a fork of [Marzban](https://github.com/Gozargah/Marzban) and is
licensed under the AGPL-3.0. By submitting a pull request you agree that your
contribution is distributed under that same license.

## Reporting issues

Security vulnerabilities do not go here — report those privately, the way
[SECURITY.md](./SECURITY.md) describes.

For everything else, include the following in your report:

- What you expected to happen and what actually happened.
- Server logs, or the error shown in the browser.
- Your Xray JSON config and relevant `.env` settings, with secrets censored.
- The versions of Xenith, Xray and Docker you are running.

## Submitting a pull request

Branch off `main`. If there is no open issue covering your change, prefer opening
one first so the approach can be discussed before you invest time in it.

Note anything a user would notice in `CHANGELOG.md`, under *Unreleased*.

## Project structure

```
.
├── app                      # Backend (FastAPI - Python)
│   └── dashboard            # Frontend (React - TypeScript)
├── cli                      # CLI (Typer - Python)
├── docs/upstream            # Original Marzban documentation, kept for reference
└── xray_api                 # Client for Xray's gRPC API
```

## Backend

FastAPI with SQLAlchemy as the ORM. Pydantic models live in `app/models`,
database models and queries in `app/db`, and Alembic migrations in
`app/db/migrations`. Any change to `app/db/models.py` needs a matching migration.

Note that the database schema stays compatible with Marzban so that existing
installations can migrate — do not rename tables or reorder existing revisions.

### Formatting

```bash
autopep8 <file> --max-line-length 120
```

### Tests

```bash
pip install -r requirements-dev.txt
pytest
```

`tests/conftest.py` pins the environment before `config.py` is imported, so the
suite behaves the same with or without a local `.env`. It hands out an
in-memory database, a fixed Xray config with one inbound per protocol, a set of
hosts you can override, and an API client that talks to the real router — see
the `db`, `xray_config`, `hosts` and `client` fixtures. Calls into the Xray core
are stubbed and recorded in `no_xray_calls`, so nothing needs the binary.

Tests that describe a known bug are marked `xfail(strict=True)`: they turn into
a failure the moment the bug is fixed, which is the reminder to delete the mark.

New tests alongside your change are welcome; the API and the database layer are
the parts most worth adding to.

CI runs the same suite on every push and pull request, and the Docker image is
only built and published once it passes. See [docs/CI.md](./docs/CI.md) for the
pipeline, the image tags and how deployment is wired up.

## Frontend

Chakra UI is the component library; follow its conventions. Prefer cohesive,
single-purpose components, and favour readability over brevity.

The frontend is built inside the Docker image, so `app/dashboard/build` is not
tracked in git — there is nothing to rebuild before committing. For local work,
run `pnpm install` in `app/dashboard`, delete the `build` directory and start the
backend again.

## CLI

Built with [Typer](https://typer.tiangolo.com/). Command code lives in `cli/`.
Regenerate its documentation with `typer-cli` installed:

```bash
PYTHONPATH=$(pwd) typer xenith-cli.py utils docs --name "" --output ./cli/README.md
```

## Debug mode

Set `DEBUG=true` in `.env` and run `main.py`. Backend and frontend then run
separately with auto-reload. Install the packages first:

```bash
cd app/dashboard && pnpm install && cd ../..
```

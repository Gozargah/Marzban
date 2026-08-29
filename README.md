<p align="center">
    <img src="docs/assets/xenith-banner.svg" alt="Xenith — Xray control panel" width="640">
</p>

<p align="center">
    A proxy management panel built on <a href="https://github.com/XTLS/Xray-core">Xray-core</a> —
    <br>users, traffic limits and subscription links across one or many servers.
</p>

<p align="center">
    <a href="https://github.com/bugbusta/Xenith/actions/workflows/build.yml"><img src="https://img.shields.io/github/actions/workflow/status/bugbusta/Xenith/build.yml?branch=main&style=flat-square&label=build" alt="Build status"></a>
    <a href="https://github.com/bugbusta/Xenith/pkgs/container/xenith"><img src="https://img.shields.io/badge/ghcr.io-xenith-blue?style=flat-square" alt="Container image"></a>
    <a href="./CHANGELOG.md"><img src="https://img.shields.io/github/v/tag/bugbusta/Xenith?style=flat-square&label=version" alt="Version"></a>
    <a href="./LICENSE"><img src="https://img.shields.io/badge/license-AGPL--3.0-blue?style=flat-square" alt="License"></a>
</p>

---

## What it is

Xenith manages the users behind an Xray server: who exists, how much traffic
they may use, when they expire, and what their subscription link hands out. It
does that through four interfaces over one database — a web dashboard, a REST
API, a CLI and a Telegram bot — and it scales from a single box to a panel
driving many nodes.

It is a fork of [Marzban](https://github.com/Gozargah/Marzban) by Gozargah,
under the AGPL-3.0. It is an independent project and is **not** affiliated with
or endorsed by the Marzban maintainers — report issues here, not upstream.

## What it does

**Users and subscriptions.** Traffic and expiry limits, on-hold accounts that
start counting on first use, scheduled next plans, per-user device limits by
hardware id, auto-delete windows, and templates so a new user is one click.
Subscription links render for v2rayN, v2rayNG, Clash, sing-box, Streisand, Happ
and Outline, each from a template you can override.

**Servers.** One panel, many nodes. A node's self-signed certificate is pinned
on the first connection and required thereafter, so an intercepted link is
refused rather than trusted. Traffic is recorded per node, with a usage
coefficient for the ones that cost more.

**The host it runs on.** From the panel you can edit and reload the host's
nginx, issue Let's Encrypt certificates through certbot, tune sysctl and raise
open file limits. Each of those is off until you turn it on, because each one
reaches outside the container.

**Notifications.** Telegram and Discord reports, plus webhooks with retries,
for user creation, status changes, usage thresholds and logins.

## Quick start

On a fresh Debian or Ubuntu server the installer does everything — Docker, the
image, a certificate, `.env`, and the first start:

```bash
curl -fsSL https://raw.githubusercontent.com/bugbusta/Xenith/main/scripts/install.sh -o install.sh
sudo bash install.sh --domain panel.example.com --email ops@example.com
```

It prints the dashboard URL and the sudo password at the end — the password is
shown once. It also leaves a `xenith` command on the host:

```bash
xenith logs -f                 # panel logs
xenith restart                 # restart after editing .env
xenith cli admin create --sudo # add an admin
xenith update                  # pull or rebuild the image and restart
```

<details>
<summary><b>Or by hand, with Docker Compose</b></summary>

```yaml
services:
  xenith:
    image: ghcr.io/bugbusta/xenith:latest
    restart: always
    env_file: .env
    network_mode: host
    # Uncomment to manage the host's nginx from the panel, and set
    # NGINX_ENABLED=true. `pid: host` is what lets the panel signal the host's
    # nginx master; it also removes process isolation between the two, so turn
    # it on deliberately.
    # pid: host
    # A proxy holds two descriptors per connection; the Docker default of 1024
    # runs out long before anything else does.
    ulimits:
      nofile:
        soft: 1048576
        hard: 1048576
    volumes:
      - /var/lib/marzban:/var/lib/marzban
      # - /etc/nginx:/etc/nginx
      # - /var/www:/var/www
      # - /var/log/nginx:/var/log/nginx
      # - /run:/run
```

```bash
cp .env.example .env   # set SUDO_USERNAME and SUDO_PASSWORD at minimum
docker compose up -d
```

</details>

The dashboard is at `/dashboard/`. [docs/INSTALL.md](./docs/INSTALL.md) covers
the manual steps, reverse proxies, upgrades, backups and open file limits.

> [!IMPORTANT]
> The panel binds to localhost unless `UVICORN_SSL_CERTFILE` and
> `UVICORN_SSL_KEYFILE` are set. Put it behind a reverse proxy with TLS, or
> reach it over SSH — the dashboard will work that way, subscription links
> will not:
>
> ```bash
> ssh -L 8000:localhost:8000 user@serverip
> ```

## Configuration

Everything is read from environment variables or `.env`.
[.env.example](./.env.example) is the full list, commented.

### Behind a reverse proxy

Forwarding headers are believed only from proxies listed in `TRUSTED_PROXIES`
(IPs or CIDRs, `*` for every peer). The list is empty by default, so
`X-Forwarded-For` and `X-Real-IP` are ignored and a client talking to the panel
directly cannot forge the address used for rate limiting and login
notifications.

With nginx or Caddy in front, set it — otherwise every login looks like it came
from the proxy itself:

```ini
TRUSTED_PROXIES = '127.0.0.1,::1'
```

Failed logins are rate limited per address: `LOGIN_RATE_LIMIT_ATTEMPTS`
failures within `LOGIN_RATE_LIMIT_WINDOW` seconds return `429` until the window
slides past. A successful login clears the counter.

### Sessions

The dashboard authenticates with an httpOnly `SameSite=Strict` cookie set by
`POST /api/admin/token`, so no script on the page can read the JWT and no
cross-site request can carry it. `Secure` is added automatically over HTTPS,
including through a proxy in `TRUSTED_PROXIES` that sets `X-Forwarded-Proto`.

The same response still returns `access_token` in its body, so the CLI and API
clients keep working with the `Authorization: Bearer` header.
`POST /api/admin/logout` clears the cookie.

Cross-origin access is off unless `ALLOWED_ORIGINS` lists the origins that need
it; the bundled dashboard is same-origin, so the default suits most installs. A
`*` there disables credentialed requests — browsers reject a wildcard combined
with credentials — and logs a warning at startup.

### API

The panel is driven entirely through its REST API; the dashboard is one client
of it. Interactive documentation is generated from the code but served only
when `DOCS=true`, which also exposes the schema:

| Path | What it is |
|---|---|
| `/docs` | Swagger UI |
| `/redoc` | ReDoc |
| `/openapi.json` | The schema itself |

Leave `DOCS` off on a public install.

## Nodes

Multi-server setups use [Marzban-Node](https://github.com/Gozargah/Marzban-node)
on the remote machines. Xenith speaks the same protocol, so upstream nodes work
unchanged.

A node's self-signed certificate is pinned on the first successful connection
and required on every one after that. If a node is reinstalled it generates a
new certificate and the panel refuses it until the pin is cleared:

```
POST /api/node/{node_id}/reset-certificate
```

Only clear a pin when you expect the certificate to have changed.

## Migrating

<details>
<summary><b>From Marzban</b></summary>

Data is fully compatible:

- the data directory stays at `/var/lib/marzban`
- the database schema and Alembic revisions are unchanged
- existing subscription links keep working while
  `ACCEPT_LEGACY_SUBSCRIPTION_TOKENS` is on — see *After installing* in
  [docs/INSTALL.md](./docs/INSTALL.md) for how to close that window
- `marzban-cli` remains as an alias of `xenith-cli`
- `MARZBAN_ADMIN_PASSWORD` is still honoured alongside `XENITH_ADMIN_PASSWORD`

In practice: point `docker-compose.yml` at the Xenith image and restart. Back
up `/var/lib/marzban` and `.env` first.

</details>

<details>
<summary><b>From SkyPanel</b></summary>

The panel was called SkyPanel before the rename. Nothing in your data changes:

- point `docker-compose.yml` at `ghcr.io/bugbusta/xenith` and restart
- `skypanel-cli` still works, as an alias of `xenith-cli`
- `SKYPANEL_ADMIN_PASSWORD` is still read
- sessions are signed under a new cookie name, so everyone signs in once more

</details>

## Development

Requires Python 3.12 — the version the image is built on — and Node.js with
pnpm (`corepack enable` sets pnpm up from the version pinned in
`package.json`).

```bash
python3.12 -m venv .venv && source .venv/bin/activate
pip install -r requirements-dev.txt
cd app/dashboard && pnpm install && cd ../..
pytest
```

Set `DEBUG=true` in `.env` and run `python main.py`; backend and frontend then
run separately with auto-reload. Because the session cookie is
`SameSite=Strict`, open the dev server on the same host the API uses
(`http://127.0.0.1:3000` when `VITE_BASE_API` points at `127.0.0.1`) — `DEBUG`
allows both dev server origins through CORS on its own.

Python is formatted with `autopep8 <file> --max-line-length 120`.
[CONTRIBUTING.md](./CONTRIBUTING.md) has the project layout, the test fixtures,
and the one rule worth knowing up front: the database schema stays compatible
with Marzban, so existing installs can keep migrating.

Pushing to `main` builds and publishes the image, and can deploy it — see
[docs/CI.md](./docs/CI.md).

## Documentation

| | |
|---|---|
| [docs/INSTALL.md](./docs/INSTALL.md) | Installing, reverse proxies, upgrades, backups, nginx |
| [docs/CI.md](./docs/CI.md) | Build pipeline, image tags, deployment, releases |
| [CONTRIBUTING.md](./CONTRIBUTING.md) | Project layout, tests, how to submit a change |
| [CHANGELOG.md](./CHANGELOG.md) | What changed in each release |
| [SECURITY.md](./SECURITY.md) | Reporting a vulnerability, and what is in scope |

Xenith's own feature documentation is still being written. Until then the
upstream Marzban documentation applies to most of it and is mirrored under
[docs/upstream/](./docs/upstream/) — note that its installation instructions
refer to Gozargah's scripts, which Xenith does not use.

## Security

Report vulnerabilities privately through
[GitHub's advisory form](https://github.com/bugbusta/Xenith/security/advisories/new),
not a public issue. [SECURITY.md](./SECURITY.md) says what is in scope and
which settings decide how exposed an install is.

## License

[GNU Affero General Public License v3.0](./LICENSE).

Because Xenith is AGPL-licensed and runs as a network service, anyone who uses
a modified instance is entitled to receive its source code. Forks and derived
works must stay under the same license.

Original work Copyright © Gozargah (Marzban).
Modifications Copyright © Xenith contributors.

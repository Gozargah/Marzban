# Changelog

Notable changes to Xenith. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and the project
follows [semantic versioning](https://semver.org/).

The `0.8.x` tags in this repository belong to
[Marzban](https://github.com/Gozargah/Marzban), from before the fork. Xenith's
own history starts at 0.9.0; for anything older, see the upstream changelog.

## [Unreleased]

## [0.9.0] — unreleased

First release under the Xenith name. The panel was called SkyPanel during
development and Marzban before that; see *Upgrading* below.

### Security

- Subscription tokens are signed with HMAC-SHA256 instead of a 60-bit
  truncated hash. Links issued before the change keep working while
  `ACCEPT_LEGACY_SUBSCRIPTION_TOKENS` is on, which is a migration window rather
  than a permanent setting — the log says once per restart when an old link is
  used, so a quiet log means everyone has moved over.
- The dashboard authenticates with an httpOnly, `SameSite=Strict` cookie, so no
  script on the page can read the JWT and no cross-site request can carry it.
  `POST /api/admin/token` still returns the token in its body, so the CLI and
  API clients are unaffected.
- Node certificates are pinned on the first successful connection and required
  on every connection after that; an intercepted link is refused instead of
  silently trusted. Clear a pin with `POST /api/node/{id}/reset-certificate`
  after a node is reinstalled.
- Failed admin logins are rate limited per client address
  (`LOGIN_RATE_LIMIT_ATTEMPTS`, `LOGIN_RATE_LIMIT_WINDOW`); a successful login
  clears the counter.
- Forwarding headers are believed only from proxies listed in
  `TRUSTED_PROXIES`. The list is empty by default, so a client talking to the
  panel directly cannot forge the address used for rate limiting and login
  notifications.
- Admin passwords are no longer included in the Telegram and Discord reports
  sent on a failed login.
- Cross-origin access is off unless `ALLOWED_ORIGINS` lists the origins that
  need it. A `*` there disables credentialed requests and logs a warning.
- 41 known advisories closed across the pinned dependencies, and `pip-audit`
  now runs in CI as its own job — a new advisory fails the build.

### Added

- **nginx management** from the panel: edit, enable and disable sites, upload
  static pages, read logs, reload. Every configuration is checked with
  `nginx -t` before it is kept, and rolled back if it fails. Off until
  `NGINX_ENABLED` is set.
- **TLS certificates** through certbot, from the Certificates screen (HTTP-01,
  standalone or webroot). Off until `CERTBOT_ENABLED` is set.
- **Kernel and network settings**: sysctl tuning and network profiles from the
  System screen, written to a single file the panel owns. Off until
  `SYSCTL_ENABLED` is set.
- **Open file limits**: the panel raises its own soft limits at startup, which
  needs no privilege. `ULIMIT_ENABLED` additionally writes the host's limit
  files.
- **Per-user device limit** by hardware id (`USERS_DEFAULT_HWID_DEVICE_LIMIT`,
  `HWID_HEADER`, or a limit on the user). Off by default: with a limit in force
  a client that reports no identifier is refused, and most clients report none.
- **`scripts/install.sh`**, which takes a fresh Debian or Ubuntu server to a
  running panel over HTTPS in one command, and installs a `xenith` command on
  the host for logs, restarts, updates and CLI access.
- **Self-update** from the panel, and a CI pipeline that builds and publishes
  the image on every push to `main` and can deploy it over SSH.

### Changed

- Renamed to Xenith, with a redesigned dashboard.
- The frontend is built inside the Docker image; `app/dashboard/build` is no
  longer tracked in git.
- The image pins Python 3.12, installs certbot in its own virtualenv (it wants
  newer dependencies than the panel pins), and carries `procps` for sysctl.
- A failed database migration now stops the container from starting instead of
  letting it serve requests against a schema it does not expect.
- Both webhook senders (Discord and `WEBHOOK_ADDRESS`) time out rather than
  hanging the thread they run on — see `DISCORD_WEBHOOK_TIMEOUT` and
  `WEBHOOK_REQUEST_TIMEOUT`.
- Core version is resolved lazily, so the panel starts without the Xray binary
  present.

### Fixed

- Fourteen findings from two read-throughs of the panel, covering
  authorization, input validation and error handling.
- `distutils.version`, removed in Python 3.12, replaced with a local parser.
- Node connection and timeout handling.

### Upgrading

Data is unchanged: the directory stays `/var/lib/marzban`, the schema and the
Alembic revisions are Marzban's. Point `docker-compose.yml` at
`ghcr.io/bugbusta/xenith:latest` and restart. Back up `/var/lib/marzban` and
`.env` first.

Everyone signs in once more — sessions are carried in a new cookie. The
`marzban-cli` and `skypanel-cli` commands, and the `MARZBAN_ADMIN_PASSWORD` and
`SKYPANEL_ADMIN_PASSWORD` variables, all still work as aliases.

[Unreleased]: https://github.com/bugbusta/Xenith/compare/v0.9.0...HEAD
[0.9.0]: https://github.com/bugbusta/Xenith/releases/tag/v0.9.0

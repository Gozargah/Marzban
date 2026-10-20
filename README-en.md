# npvpn panel

[Русский](README.md) · [Releases](https://github.com/npvpn/vpn-panel/releases) · [Docker Hub](https://hub.docker.com/r/npvpn/panel) · [License](LICENSE)

**npvpn panel** is a fork of Marzban built for real commercial VPN projects.  
The panel is tuned for scalable setups, high performance and convenient management of distributed infrastructure.  
It is developed as a base for running VPN services and automated Telegram bots.

---

## Purpose

- Scalable architecture for large VPN projects  
- Performance and stability optimizations  
- Support for real production configurations (VLESS, XRay, multi-node)  
- Simpler management of nodes and servers  
- Integration with npvpn Telegram bots  
- Suitable for business, partner services and white-label solutions

---

## How it differs from Marzban

- **Node roles and cascade.** A node can be an entry, an exit or a regular (direct) node; the panel adds the cascade parts of the xray config itself. Details: [docs/cascade-node-roles.md](docs/cascade-node-roles.md) (Russian only).
- **Monthly traffic limit for selected nodes (BS nodes).** The counter is kept per month and reset when the month changes; when the limit is exceeded, clients are blocked on the node.
- **Multi-address hosts and balancing.** A host linked to several nodes is served in the v2ray-json subscription as a single config with an xray balancer.
- **Xray template editor.** Configuration templates are stored in the panel with versions and edited through the API and the dashboard.
- **Node config cache.** The ready JSON string of each node's config is cached for the duration of one reconnect wave, which reduces load when many nodes reconnect at once.

---

## Installation

### Regular installation

**SQLite** — no SSL, the panel listens on port 8000.

```bash
sudo bash -c "$(curl -sL https://github.com/npvpn/Marzban-scripts/raw/master/marzban.sh)" @ install
```

The script asks two questions: the subscription title shown in the client and the Telegram bot username (you can leave both empty — press Enter). The script does not ask for a support link: until it is set, the support link in the subscription points to `https://t.me/` (an empty link). Set it later in `/opt/marzban/.env` (`SUB_SUPPORT_URL`) and run `marzban restart`.

The installation always ends by streaming the panel logs unless `--no-logs` is passed. Press Ctrl+C — this does not stop the panel.

After the installation, create an administrator:

```bash
marzban cli admin create
```

The command asks for a username, "Is sudo [y/N]" (answer `y` for the main administrator), a password with confirmation, and optional Telegram ID and Discord webhook.

Log in at `http://<IP or domain>:8000/dashboard/#/login`.

**MySQL / MariaDB** — automatic Let's Encrypt, certificate volumes in compose, HTTPS on port 8001. UFW, the panel administrator and the GitHub runner are not installed (that is `install-partner` only).

Before you start: an A record of the domain pointing to the server IP, port 80 free (certbot standalone), Debian/Ubuntu.

Interactive (the script asks for the domain and the Let's Encrypt email):

```bash
sudo bash -c "$(curl -sL https://github.com/npvpn/Marzban-scripts/raw/master/marzban.sh)" @ install --database mysql
```

```bash
sudo bash -c "$(curl -sL https://github.com/npvpn/Marzban-scripts/raw/master/marzban.sh)" @ install --database mariadb
```

With parameters:

```bash
sudo bash -c "$(curl -sL https://github.com/npvpn/Marzban-scripts/raw/master/marzban.sh)" @ install --database mysql \
  --domain panel.example.com \
  --cert-email admin@example.com \
  --non-interactive
```

Optional: `--uvicorn-port 8001`, `--skip-dns-check`, `--skip-cert` (certificates are already in `/etc/letsencrypt/live/<domain>/`), `--no-logs`.

The installation always ends by streaming the panel logs unless `--no-logs` is passed; Ctrl+C returns control and does not stop the panel. With `--non-interactive` the subscription title, the bot link and the support link keep their default values; you can change them later in `/opt/marzban/.env` (`SUB_PROFILE_TITLE`, `BOT_URL`, `SUB_SUPPORT_URL`) and apply them with `marzban restart`.

After the installation, create an administrator:

```bash
marzban cli admin create
```

The command asks for a username, "Is sudo [y/N]" (answer `y` for the main administrator), a password with confirmation, and optional Telegram ID and Discord webhook.

Log in at `https://<domain>:8001/dashboard/`.

---

### Upgrading from the original panel

If the panel was installed from the original Marzban repository, you can switch it to `npvpn panel` without reinstalling:

1. Connect to the server where the panel is installed.
2. Open `docker-compose`:

```bash
marzban edit
```

3. In the `marzban` service, set the image to `npvpn/panel:latest` and check the `volumes` block:

```yaml
services:
  marzban:
    image: npvpn/panel:latest
    restart: always
    env_file: .env
    network_mode: host
    volumes:
      - /var/lib/marzban:/var/lib/marzban
      - /var/lib/marzban/logs:/var/lib/marzban-node
      # if the panel serves HTTPS — the directory with certificates:
      # - /etc/letsencrypt:/etc/letsencrypt:ro
```

Keep the `depends_on` block on the `mysql` service only if your current file already has a `mysql` service (a MySQL/MariaDB installation); do not add it for SQLite. If your certificates are not in `/etc/letsencrypt`, mount your own paths — the paths inside the container must match `UVICORN_SSL_CERTFILE` and `UVICORN_SSL_KEYFILE` in `.env`.

4. Pull the new image:

```bash
docker pull npvpn/panel:latest
```

5. Restart the panel:

```bash
marzban restart
```

---

### Partner installation

For npvpn partners there is an automatic installation that issues a certificate and configures the server: [docs/partner-install.md](docs/partner-install.md) (Russian only).

---

## Node installation

### Migrating an original node

Migrate an already installed node (Watchtower, conntrack, node_exporter).

```bash
sudo bash -c "$(curl -sL https://github.com/npvpn/Marzban-scripts/raw/master/marzban-node.sh)" @ migrate
```

If the node is used with an npvpn bot, pass the public IP of the bot server — then `:9100` is opened to it only:

```bash
sudo bash -c "$(curl -sL https://github.com/npvpn/Marzban-scripts/raw/master/marzban-node.sh)" @ migrate --bot-server-ip 1.2.3.4
```

Details: [Marzban-scripts/README.md](https://github.com/npvpn/Marzban-scripts/blob/master/README.md).

---

### New installation

On a separate server:

```bash
sudo bash -c "$(curl -sL https://github.com/npvpn/Marzban-scripts/raw/master/marzban-node.sh)" @ install
```

The script asks interactively for:

1. The panel's **Client Certificate** — paste the whole PEM (from `-----BEGIN CERTIFICATE-----` to `-----END CERTIFICATE-----`) and press Enter on an empty line. You can get the certificate in the panel dashboard: "Node Settings" → "Add New Marzban Node" → "Show certificate" (or "Download certificate"). Alternatively, use the API: `GET /api/node/settings` (field `certificate`). The script does not validate the certificate: if you paste it truncated, the node restarts endlessly.
2. Whether to use the REST protocol (yes by default), `SERVICE_PORT` (62050 by default) and `XRAY_API_PORT` (62051 by default).
3. The bot IPv4 address to restrict `:9100` to (see below; empty input leaves the port public).

The node must be reachable from the panel on `SERVICE_PORT`. After the installation, add the node in the panel: "Node Settings" → "Add New Marzban Node" (server address, ports 62050 and 62051); the status should become `connected`. Until the node is added to the panel, a fresh node listens only on `SERVICE_PORT` (62050); `XRAY_API_PORT` (62051) appears after the xray core starts.

With a custom name:

```bash
sudo bash -c "$(curl -sL https://github.com/npvpn/Marzban-scripts/raw/master/marzban-node.sh)" @ install --name marzban-node2
```

**node_exporter** (`:9100`, host network) is installed together with the node for Prometheus on the bot. You can pass the npvpn bot IP right away — then `:9100` is opened to it only (nftables, UFW is not enabled):

```bash
sudo bash -c "$(curl -sL https://github.com/npvpn/Marzban-scripts/raw/master/marzban-node.sh)" @ install --bot-server-ip 1.2.3.4
```

Without the flag the script asks for the IP interactively; empty input — the exporter starts and the port stays public. `--skip-firewall` skips the port restriction.

Only the `marzban-node` CLI command (without the node itself):

```bash
sudo bash -c "$(curl -sL https://github.com/npvpn/Marzban-scripts/raw/master/marzban-node.sh)" @ install-script
```

List of commands: `marzban-node help`.

Update or change the Xray-core version:

```bash
sudo marzban-node core-update
```

---

## Versions and images

Versions follow the release date: `vYYYY.MM.DD`, a hotfix on the same day is `vYYYY.MM.DD.N`. The image for a version is `npvpn/panel:YYYY.MM.DD` (Docker Hub) and `ghcr.io/npvpn/panel:YYYY.MM.DD`; `latest` points to the latest release. The changelog is in the [releases](https://github.com/npvpn/vpn-panel/releases).

---

## Development

How to build the project locally, run the checks and submit a change — see [CONTRIBUTING.md](CONTRIBUTING.md) (Russian, with a short English summary).

---

## License

The project is distributed under the **AGPL-3.0** license, like the original Marzban.  
This means that any modifications of the panel made available to users over a network must be published in open form.

Separate integrations (bots, billing, API gateways) that do not include the panel code may use other licenses.

npvpn panel is based on [Marzban](https://github.com/Gozargah/Marzban) (Gozargah).

---

## Contacts

Bugs and suggestions — [GitHub Issues](https://github.com/npvpn/vpn-panel/issues). Questions — [t.me/npvpn](https://t.me/npvpn).

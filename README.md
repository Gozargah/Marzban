<h1 align="center">NeonGate</h1>

<p align="center">
    A proxy management panel built on the <a href="https://github.com/Gozargah/Marzban">Marzban</a> codebase, powered by <a href="https://github.com/XTLS/Xray-core">Xray</a>.
</p>

<p align="center">
 <a href="./README.md">English</a> /
 <a href="./README-fa.md">فارسی</a> /
 <a href="./README-zh-cn.md">简体中文</a> /
 <a href="./README-ru.md">Русский</a>
</p>

## Table of Contents

- [Overview](#overview)
  - [Why using NeonGate?](#why-using-neongate)
    - [Features](#features)
- [Installation guide](#installation-guide)
- [Configuration](#configuration)
- [Documentation](#documentation)
- [API](#api)
- [Backup](#backup)
- [Telegram Bot](#telegram-bot)
- [NeonGate CLI](#neongate-cli)
- [Node support](#node-support)
- [Webhook notifications](#webhook-notifications)
- [License](#license)
- [Contributing](#contributing)

# Overview

NeonGate is a proxy management panel built on the [Marzban](https://github.com/Gozargah/Marzban) codebase that provides a simple and easy-to-use user interface for managing hundreds of proxy accounts powered by [Xray-core](https://github.com/XTLS/Xray-core) and built using Python and Reactjs.

## Why using NeonGate?

NeonGate is user-friendly, feature-rich and reliable. It lets you to create different proxies for your users without any complicated configuration. Using its built-in web UI, you are able to monitor, modify and limit users.

### Features

- Built-in **Web UI**
- Fully **REST API** backend
- [**Multiple Nodes**](#node-support) support (for infrastructure distribution & scalability)
- Supports protocols **Vmess**, **VLESS**, **Trojan** and **Shadowsocks**
- **Multi-protocol** for a single user
- **Multi-user** on a single inbound
- **Multi-inbound** on a **single port** (fallbacks support)
- **Traffic** and **expiry date** limitations
- **Periodic** traffic limit (e.g. daily, weekly, etc.)
- **Subscription link** compatible with **V2ray** _(such as V2RayNG, SingBox, Nekoray, etc.)_, **Clash** and **ClashMeta**
- Automated **Share link** and **QRcode** generator
- System monitoring and **traffic statistics**
- Customizable xray configuration
- **TLS** and **REALITY** support
- Integrated **Telegram Bot**
- Integrated **Command Line Interface (CLI)**
- **Multi-language**
- **Multi-admin** support (WIP)

# Installation guide

NeonGate is distributed as a Docker image on GitHub Container Registry. The recommended deployment uses Docker Compose.

### 1. Install Docker (skip if already installed)

```bash
curl -fsSL https://get.docker.com | sh
```

### 2. Create directories

```bash
sudo mkdir -p /opt/marzban /var/lib/marzban
```

### 3. Create `/opt/marzban/docker-compose.yml`

```yaml
services:
  neongate:
    image: ghcr.io/dayanch437/marzban-1:dev
    restart: always
    env_file: .env
    network_mode: host
    volumes:
      - /var/lib/marzban:/var/lib/marzban
      - /var/log/xray:/var/log/xray
```

### 4. Create `.env` configuration

Copy the template from the repo and edit it:

```bash
curl -o /opt/marzban/.env https://raw.githubusercontent.com/Dayanch437/Marzban-1/dev/.env.example
nano /opt/marzban/.env
```

At minimum set `DASHBOARD_PATH`, `XRAY_SUBSCRIPTION_PATH`, and your Telegram bot credentials if you want notifications.

### 5. Start NeonGate

```bash
cd /opt/marzban && docker compose pull && docker compose up -d
```

### 6. Create the first admin user

```bash
docker compose exec neongate marzban-cli admin create --sudo
```

### 7. Access the dashboard

Open `https://YOUR_DOMAIN<DASHBOARD_PATH>` in your browser (for example: `https://your.domain/pizza/`).

For security, NeonGate should be served behind a reverse proxy with HTTPS (Caddy, Nginx, or Traefik). See the nginx example below.

Once installed:
- Config: `/opt/marzban/.env`
- Database & xray config: `/var/lib/marzban/`
- To upgrade in place: `cd /opt/marzban && docker compose pull && docker compose up -d`

If you want to run the project from source instead, check the section below.

<details markdown="1">
<summary><h3>Manual install (advanced)</h3></summary>

Install xray on your machine

You can install it using [Xray-install](https://github.com/XTLS/Xray-install)

```bash
bash -c "$(curl -L https://github.com/XTLS/Xray-install/raw/main/install-release.sh)" @ install
```

Clone this project and install the dependencies (you need Python >= 3.12.7)

```bash
git clone https://github.com/Dayanch437/Marzban-1.git
cd Marzban-1
wget -qO- https://bootstrap.pypa.io/get-pip.py | python3 -
python3 -m pip install -r requirements.txt
```

Alternatively, to have an isolated environment you can use [Python Virtualenv](https://pypi.org/project/virtualenv/)

Then run the following command to run the database migration scripts

```bash
alembic upgrade head
```

If you want to use `marzban-cli`, you should link it to a file in your `$PATH`, make it executable, and install the auto-completion:

```bash
sudo ln -s $(pwd)/marzban-cli.py /usr/bin/marzban-cli
sudo chmod +x /usr/bin/marzban-cli
marzban-cli completion install
```

Now it's time to configuration

Make a copy of `.env.example` file, take a look and edit it using a text editor like `nano`.

You probably like to modify the admin credentials.

```bash
cp .env.example .env
nano .env
```

> Check [configurations](#configuration) section for more information

Eventually, launch the application using command below

```bash
python3 main.py
```

To launch with linux systemctl (copy marzban.service file to `/var/lib/marzban/marzban.service`)

```
systemctl enable /var/lib/marzban/marzban.service
systemctl start marzban
```

To use with nginx

```
server {
    listen 443 ssl http2;
    listen [::]:443 ssl http2;
    server_name  example.com;

    ssl_certificate      /etc/letsencrypt/live/example.com/fullchain.pem;
    ssl_certificate_key  /etc/letsencrypt/live/example.com/privkey.pem;

    location ~* /(dashboard|statics|sub|api|docs|redoc|openapi.json) {
        proxy_pass http://0.0.0.0:8000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    }

    # xray-core ws-path: /
    # client ws-path: /neongate/me/2087
    #
    # All traffic is proxed through port 443, and send to the xray port(2087, 2088 etc.).
    # The '/neongate' in location regex path can changed any characters by yourself.
    #
    # /${path}/${username}/${xray-port}
    location ~* /neongate/.+/(.+)$ {
        proxy_redirect off;
        proxy_pass http://127.0.0.1:$1/;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $http_host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    }
}
```

or

```
server {
    listen 443 ssl http2;
    listen [::]:443 ssl http2;
    server_name  neongate.example.com;

    ssl_certificate      /etc/letsencrypt/live/example.com/fullchain.pem;
    ssl_certificate_key  /etc/letsencrypt/live/example.com/privkey.pem;

    location / {
        proxy_pass http://0.0.0.0:8000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    }
}
```

By default the app will be run on `http://localhost:8000/dashboard`. You can configure it using changing the `UVICORN_HOST` and `UVICORN_PORT` environment variables.

</details>

# Configuration

> You can set settings below using environment variables or placing them in `.env` file.

| Variable                                 | Description                                                                                                              |
| ---------------------------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| SUDO_USERNAME                            | Superuser's username                                                                                                     |
| SUDO_PASSWORD                            | Superuser's password                                                                                                     |
| SQLALCHEMY_DATABASE_URL                  | Database URL ([SQLAlchemy's docs](https://docs.sqlalchemy.org/en/20/core/engines.html#database-urls))                    |
| UVICORN_HOST                             | Bind application to this host (default: `0.0.0.0`)                                                                       |
| UVICORN_PORT                             | Bind application to this port (default: `8000`)                                                                          |
| UVICORN_UDS                              | Bind application to a UNIX domain socket                                                                                 |
| UVICORN_SSL_CERTFILE                     | SSL certificate file to have application on https                                                                        |
| UVICORN_SSL_KEYFILE                      | SSL key file to have application on https                                                                                |
| UVICORN_SSL_CA_TYPE                      | Type of authority SSL certificate. Use `private` for testing self-signed CA (default: `public`)                          |
| XRAY_JSON                                | Path of Xray's json config file (default: `xray_config.json`)                                                            |
| XRAY_EXECUTABLE_PATH                     | Path of Xray binary (default: `/usr/local/bin/xray`)                                                                     |
| XRAY_ASSETS_PATH                         | Path of Xray assets (default: `/usr/local/share/xray`)                                                                   |
| XRAY_SUBSCRIPTION_URL_PREFIX             | Prefix of subscription URLs                                                                                              |
| XRAY_FALLBACKS_INBOUND_TAG               | Tag of the inbound that includes fallbacks, needed in the case you're using fallbacks                                    |
| XRAY_EXCLUDE_INBOUND_TAGS                | Tags of the inbounds that shouldn't be managed and included in links by application                                      |
| CUSTOM_TEMPLATES_DIRECTORY               | Customized templates directory (default: `app/templates`)                                                                |
| CLASH_SUBSCRIPTION_TEMPLATE              | The template that will be used for generating clash configs (default: `clash/default.yml`)                               |
| SUBSCRIPTION_PAGE_TEMPLATE               | The template used for generating subscription info page (default: `subscription/index.html`)                             |
| HOME_PAGE_TEMPLATE                       | Decoy page template (default: `home/index.html`)                                                                         |
| TELEGRAM_API_TOKEN                       | Telegram bot API token (get token from [@botfather](https://t.me/botfather))                                             |
| TELEGRAM_ADMIN_ID                        | Numeric Telegram ID of admin (use [@userinfobot](https://t.me/userinfobot) to found your ID)                             |
| TELEGRAM_PROXY_URL                       | Run Telegram Bot over proxy                                                                                              |
| JWT_ACCESS_TOKEN_EXPIRE_MINUTES          | Expire time for the Access Tokens in minutes, `0` considered as infinite (default: `1440`)                               |
| DOCS                                     | Whether API documents should be available on `/docs` and `/redoc` or not (default: `False`)                              |
| DEBUG                                    | Debug mode for development (default: `False`)                                                                            |
| WEBHOOK_ADDRESS                          | Webhook address to send notifications to. Webhook notifications will be sent if this value was set.                      |
| WEBHOOK_SECRET                           | Webhook secret will be sent with each request as `x-webhook-secret` in the header (default: `None`)                      |
| NUMBER_OF_RECURRENT_NOTIFICATIONS        | How many times to retry if an error detected in sending a notification (default: `3`)                                    |
| RECURRENT_NOTIFICATIONS_TIMEOUT          | Timeout between each retry if an error detected in sending a notification in seconds (default: `180`)                    |
| NOTIFY_REACHED_USAGE_PERCENT             | At which percentage of usage to send the warning notification (default: `80`)                                            |
| NOTIFY_DAYS_LEFT                         | When to send warning notifaction about expiration (default: `3`)                                                         |
| USERS_AUTODELETE_DAYS                    | Delete expired (and optionally limited users) after this many days (Negative values disable this feature, default: `-1`) |
| USER_AUTODELETE_INCLUDE_LIMITED_ACCOUNTS | Whether to include limited accounts in the auto-delete feature (default: `False`)                                        |
| USE_CUSTOM_JSON_DEFAULT                  | Enable custom JSON config for ALL supported clients (default: `False`)                                                   |
| USE_CUSTOM_JSON_FOR_V2RAYNG              | Enable custom JSON config only for V2rayNG (default: `False`)                                                            |
| USE_CUSTOM_JSON_FOR_STREISAND            | Enable custom JSON config only for Streisand (default: `False`)                                                          |
| USE_CUSTOM_JSON_FOR_V2RAYN               | Enable custom JSON config only for V2rayN (default: `False`)                                                             |

# Documentation

NeonGate is built on the [Marzban](https://github.com/Gozargah/Marzban) codebase, so the upstream [Marzban Documentation](https://gozargah.github.io/marzban) is a useful reference for advanced configuration. NeonGate-specific changes are documented in this README.

# API

NeonGate provides a REST API that enables developers to interact with NeonGate services programmatically. To view the API documentation in Swagger UI or ReDoc, set the configuration variable `DOCS=True` and navigate to the `/docs` and `/redoc`.

# Backup

It's always a good idea to backup your NeonGate files regularly to prevent data loss in case of system failures or accidental deletion. Here are the steps to backup NeonGate:

1. By default, all NeonGate important files are saved in `/var/lib/marzban` (Docker versions). Copy the entire `/var/lib/marzban` directory to a backup location of your choice, such as an external hard drive or cloud storage.
2. Additionally, make sure to backup your env file, which contains your configuration variables, and also, your Xray config file. The env and other configurations are inside `/opt/marzban/` directory.

NeonGate's backup service efficiently zips all necessary files and sends them to your specified Telegram bot. It supports SQLite, MySQL, and MariaDB databases. One of its key features is automation, allowing you to schedule backups every hour. There are no limitations concerning Telegram's upload limits for bots; if a file exceeds the limit, it will be split and sent in multiple parts. Additionally, you can initiate an immediate backup at any time.

Pull the latest NeonGate image:

```bash
cd /opt/marzban && docker compose pull && docker compose up -d
```

Setup the Backup Service:

```bash
docker compose exec neongate marzban-cli backup-service
```

Get an Immediate Backup:

```bash
docker compose exec neongate marzban-cli backup
```

By following these steps, you can ensure that you have a backup of all your NeonGate files and data, as well as your configuration variables and Xray configuration, in case you need to restore them in the future. Remember to update your backups regularly to keep them up-to-date.

# Telegram Bot

NeonGate comes with an integrated Telegram bot that can handle server management, user creation and removal, and send notifications. This bot can be easily enabled by following a few simple steps, and it provides a convenient way to interact with NeonGate without having to log in to the server every time.

To enable Telegram Bot:

1. set `TELEGRAM_API_TOKEN` to your bot's API Token
2. set `TELEGRAM_ADMIN_ID` to your Telegram account's numeric ID, you can get your ID from [@userinfobot](https://t.me/userinfobot)

# NeonGate CLI

NeonGate ships with an integrated CLI (binary name: `marzban-cli`) for administrators.

When running via Docker Compose:

```bash
docker compose exec neongate marzban-cli [OPTIONS] COMMAND [ARGS]...
```

For more information, see [CLI documentation](./cli/README.md).

# Node support

NeonGate is compatible with [Marzban-node](https://github.com/gozargah/marzban-node) for distributing your infrastructure across multiple servers. This lets you scale capacity, add redundancy, and offer users multiple server locations. Install and configure the node separately on each remote server — see the upstream [Marzban-node documentation](https://github.com/gozargah/marzban-node) for details.

# Webhook notifications

You can set a webhook address and NeonGate will send the notifications to that address.

the requests will be sent as a post request to the adress provided by `WEBHOOK_ADDRESS` with `WEBHOOK_SECRET` as `x-webhook-secret` in the headers.

Example request sent from NeonGate:

```
Headers:
Host: 0.0.0.0:9000
User-Agent: python-requests/2.28.1
Accept-Encoding: gzip, deflate
Accept: */*
Connection: keep-alive
x-webhook-secret: something-very-very-secret
Content-Length: 107
Content-Type: application/json



Body:
{"username": "test_user", "action": "user_updated", "enqueued_at": 1680506457.636369, "tries": 0}
```

Different action typs are: `user_created`, `user_updated`, `user_deleted`, `user_limited`, `user_expired`, `user_disabled`, `user_enabled`

# License

Made in [Unknown!] and Published under [AGPL-3.0](./LICENSE).

# Contributing

NeonGate is derived from the open-source [Marzban](https://github.com/Gozargah/Marzban) project. Bug reports and improvements specific to this fork are welcome — see [Contributing Guidelines](CONTRIBUTING.md).

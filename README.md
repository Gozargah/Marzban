<p align="center">
  <a href="https://github.com/gfwfuckers/marzgosha" target="_blank" rel="noopener noreferrer">
    <picture>
      <source media="(prefers-color-scheme: dark)" srcset="https://raw.githubusercontent.com/Gozargah/Marzban-docs/master/screenshots/logo-dark.png">
      <img width="160" height="160" src="https://github.com/Gozargah/Marzban-docs/raw/master/screenshots/logo-light.png">
    </picture>
  </a>
</p>

<h1 align="center"/>MarzGosha</h1>

<p align="center">
    Unified GUI Censorship Resistant Solution Powered by <a href="https://github.com/XTLS/Xray-core">Xray</a>
</p>

<br/>
<p align="center">
    <a href="#">
        <img src="https://img.shields.io/github/actions/workflow/status/gfwfuckers/marzgosha/build.yml?style=flat-square" />
    </a>
    <a href="https://hub.docker.com/r/gfwfuckers/marzgosha" target="_blank">
        <img src="https://img.shields.io/docker/pulls/gfwfuckers/marzgosha?style=flat-square&logo=docker" />
    </a>
    <a href="#">
        <img src="https://img.shields.io/badge/twitter-commiunity-blue?style=flat-square&logo=twitter" />
    </a>
    <a href="#">
        <img src="https://img.shields.io/github/stars/gfwfuckers/marzgosha?style=social" />
    </a>
</p>

<p align="center">
 <a href="./README.md">
 English
 </a>
 /
 <a href="./README-fa.md">
 فارسی
 </a>
  /
  <a href="./README-zh-cn.md">
 简体中文
 </a>
   /
  <a href="./README-ru.md">
 Русский
 </a>
</p>

<p align="center">
  <a href="https://github.com/gfwfuckers/marzgosha" target="_blank" rel="noopener noreferrer" >
    <img src="https://github.com/Gozargah/Marzban-docs//raw/master/screenshots/preview.png" alt="MarzGosha screenshots" width="600" height="auto">
  </a>
</p>

## Table of Contents

- [Overview](#overview)
  - [Why using MarzGosha?](#why-using-marzgosha)
    - [Features](#features)
- [Installation guide](#installation-guide)
- [Configuration](#configuration)
- [API](#api)
- [Backup](#backup)
- [Telegram Bot](#telegram-bot)
- [MarzGosha CLI](#marzgosha-cli)
- [MarzGosha Node](#marzgosha-node)
- [Webhook notifications](#webhook-notifications)
- [Donation](#donation)
- [License](#license)
- [Contributors](#contributors)

# Overview

MarzGosha (the Persian word for "border guard" - pronounced /mærz'ban/) is a proxy management tool that provides a simple and easy-to-use user interface for managing hundreds of proxy accounts powered by [Xray-core](https://github.com/XTLS/Xray-core) and built using Python and Reactjs.

## Why using MarzGosha?

MarzGosha is user-friendly, feature-rich and reliable. It lets you to create different proxies for your users without any complicated configuration. Using its built-in web UI, you are able to monitor, modify and limit users.

### Features

- Built-in **Web UI**
- Fully **REST API** backend
- [**Multiple Nodes**](#marzgosha-node) support (for infrastructure distribution & scalability)
- Supports protocols **Vmess**, **VLESS**, **Trojan** and **Shadowsocks**
- **Multi-protocol** for a single user
- **Multi-user** on a single inbound
- **Multi-inbound** on a **single port** (fallbacks support)
- **Traffic** and **expiry date** limitations
- **Periodic** traffic limit (e.g. daily, weekly, etc.)
- **Subscription link** compatible with **V2ray** _(such as V2RayNG, OneClick, Nekoray, etc.)_, **Clash** and **ClashMeta**
- Automated **Share link** and **QRcode** generator
- System monitoring and **traffic statistics**
- Customizable xray configuration
- **TLS** and **REALITY** support
- Integrated **Telegram Bot**
- Integrated **Command Line Interface (CLI)**
- **Multi-language**
- **Multi-admin** support (WIP)

# Installation guide

Run the following command

```bash
sudo bash -c "$(curl -sL https://github.com/GFWFuckers/MarzGosha-scripts/raw/master/marzgosha.sh)" @ install
```

Once the installation is complete:

- You will see the logs that you can stop watching them by closing the terminal or pressing `Ctrl+C`
- The MarzGosha files will be located at `/opt/marzgosha`
- The configuration file can be found at `/opt/marzgosha/.env` (refer to [configurations](#configuration) section to see variables)
- The data files will be placed at `/var/lib/marzgosha`
- You can access the MarzGosha dashboard by opening a web browser and navigating to `http://YOUR_SERVER_IP:8000/dashboard/` (replace YOUR_SERVER_IP with the actual IP address of your server)

Next, you need to create a sudo admin for logging into the MarzGosha dashboard by the following command

```bash
marzgosha cli admin create --sudo
```

That's it! You can login to your dashboard using these credentials

To see the help message of the MarzGosha script, run the following command

```bash
marzgosha --help
```

If you are eager to run the project using the source code, check the section below

<details markdown="1">
<summary><h3>Manual install (advanced)</h3></summary>

Install xray on your machine

You can install it using [Xray-install](https://github.com/XTLS/Xray-install)

```bash
bash -c "$(curl -L https://github.com/XTLS/Xray-install/raw/main/install-release.sh)" @ install
```

Clone this project and install the dependencies (you need Python >= 3.8)

```bash
git clone https://github.com/GFWFuckers/MarzGosha.git
cd MarzGosha
wget -qO- https://bootstrap.pypa.io/get-pip.py | python3 -
python3 -m pip install -r requirements.txt
```

Alternatively, to have an isolated environment you can use [Python Virtualenv](https://pypi.org/project/virtualenv/)

Then run the following command to run the database migration scripts

```bash
alembic upgrade head
```

If you want to use `marzgosha-cli`, you should link it to a file in your `$PATH`, make it executable, and install the auto-completion:

```bash
sudo ln -s $(pwd)/marzgosha-cli.py /usr/bin/marzgosha-cli
sudo chmod +x /usr/bin/marzgosha-cli
marzgosha-cli completion install
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

To launch with linux systemctl (copy marzgosha.service file to `/var/lib/marzgosha/marzgosha.service`)

```
systemctl enable /var/lib/marzgosha/marzgosha.service
systemctl start marzgosha
```

To use with nginx

```
server {
    listen 443 ssl http2;
    listen [::]:443 ssl http2;
    server_name  example.com;

    ssl_certificate      /etc/letsencrypt/live/example.com/fullchain.pem;
    ssl_certificate_key  /etc/letsencrypt/live/example.com/privkey.pem;

    location ~* /(dashboard|api|docs|redoc|openapi.json) {
        proxy_pass http://0.0.0.0:8000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    }

    # xray-core ws-path: /
    # client ws-path: /marzgosha/me/2087
    #
    # All traffic is proxed through port 443, and send to the xray port(2087, 2088 etc.).
    # The '/marzgosha' in location regex path can changed any characters by yourself.
    #
    # /${path}/${username}/${xray-port}
    location ~* /marzgosha/.+/(.+)$ {
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
    server_name  marzgosha.example.com;

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

| Variable                          | Description                                                                                           |
| --------------------------------- | ----------------------------------------------------------------------------------------------------- |
| SUDO_USERNAME                     | Superuser's username                                                                                  |
| SUDO_PASSWORD                     | Superuser's password                                                                                  |
| SQLALCHEMY_DATABASE_URL           | Database URL ([SQLAlchemy's docs](https://docs.sqlalchemy.org/en/20/core/engines.html#database-urls)) |
| UVICORN_HOST                      | Bind application to this host (default: `0.0.0.0`)                                                    |
| UVICORN_PORT                      | Bind application to this port (default: `8000`)                                                       |
| UVICORN_UDS                       | Bind application to a UNIX domain socket                                                              |
| UVICORN_SSL_CERTFILE              | SSL certificate file to have application on https                                                     |
| UVICORN_SSL_KEYFILE               | SSL key file to have application on https                                                             |
| XRAY_JSON                         | Path of Xray's json config file (default: `xray_config.json`)                                         |
| XRAY_EXECUTABLE_PATH              | Path of Xray binary (default: `/usr/local/bin/xray`)                                                  |
| XRAY_ASSETS_PATH                  | Path of Xray assets (default: `/usr/local/share/xray`)                                                |
| XRAY_SUBSCRIPTION_URL_PREFIX      | Prefix of subscription URLs                                                                           |
| XRAY_FALLBACKS_INBOUND_TAG        | Tag of the inbound that includes fallbacks, needed in the case you're using fallbacks                 |
| XRAY_EXCLUDE_INBOUND_TAGS         | Tags of the inbounds that shouldn't be managed and included in links by application                   |
| CUSTOM_TEMPLATES_DIRECTORY        | Customized templates directory (default: `app/templates`)                                             |
| CLASH_SUBSCRIPTION_TEMPLATE       | The template that will be used for generating clash configs (default: `clash/default.yml`)            |
| SUBSCRIPTION_PAGE_TEMPLATE        | The template used for generating subscription info page (default: `subscription/index.html`)          |
| HOME_PAGE_TEMPLATE                | Decoy page template (default: `home/index.html`)                                                      |
| TELEGRAM_API_TOKEN                | Telegram bot API token (get token from [@botfather](https://t.me/botfather))                          |
| TELEGRAM_ADMIN_ID                 | Numeric Telegram ID of admin (use [@userinfobot](https://t.me/userinfobot) to found your ID)          |
| TELEGRAM_PROXY_URL                | Run Telegram Bot over proxy                                                                           |
| JWT_ACCESS_TOKEN_EXPIRE_MINUTES   | Expire time for the Access Tokens in minutes, `0` considered as infinite (default: `1440`)            |
| DOCS                              | Whether API documents should be available on `/docs` and `/redoc` or not (default: `False`)           |
| DEBUG                             | Debug mode for development (default: `False`)                                                         |
| WEBHOOK_ADDRESS                   | Webhook address to send notifications to. Webhook notifications will be sent if this value was set.   |
| WEBHOOK_SECRET                    | Webhook secret will be sent with each request as `x-webhook-secret` in the header (default: `None`)   |
| NUMBER_OF_RECURRENT_NOTIFICATIONS | How many times to retry if an error detected in sending a notification (default: `3`)                 |
| RECURRENT_NOTIFICATIONS_TIMEOUT   | Timeout between each retry if an error detected in sending a notification in seconds (default: `180`) |
| NOTIFY_REACHED_USAGE_PERCENT      | At which percentage of usage to send the warning notification (default: `80`)                         |
| NOTIFY_DAYS_LEFT                  | When to send warning notifaction about expiration (default: `3`)                                      |

# API

MarzGosha provides a REST API that enables developers to interact with MarzGosha services programmatically. To view the API documentation in Swagger UI or ReDoc, set the configuration variable `DOCS=True` and navigate to the `/docs` and `/redoc`.

# Backup

It's always a good idea to backup your MarzGosha files regularly to prevent data loss in case of system failures or accidental deletion. Here are the steps to backup MarzGosha:

1. By default, all MarzGosha important files are saved in `/var/lib/marzgosha` (Docker versions). Copy the entire `/var/lib/marzgosha` directory to a backup location of your choice, such as an external hard drive or cloud storage.
2. Additionally, make sure to backup your env file, which contains your configuration variables, and also, your Xray config file. If you installed MarzGosha using marzgosha-scripts (recommended installation approach), the env and other configurations should be inside `/opt/marzgosha/` directory.

By following these steps, you can ensure that you have a backup of all your MarzGosha files and data, as well as your configuration variables and Xray configuration, in case you need to restore them in the future. Remember to update your backups regularly to keep them up-to-date.

# Telegram Bot

MarzGosha comes with an integrated Telegram bot that can handle server management, user creation and removal, and send notifications. This bot can be easily enabled by following a few simple steps, and it provides a convenient way to interact with MarzGosha without having to log in to the server every time.

To enable Telegram Bot:

1. set `TELEGRAM_API_TOKEN` to your bot's API Token
2. set `TELEGRAM_ADMIN_ID` to your Telegram account's numeric ID, you can get your ID from [@userinfobot](https://t.me/userinfobot)

# MarzGosha CLI

MarzGosha comes with an integrated CLI named `marzgosha-cli` which allows administrators to have direct interaction with it.

If you've installed MarzGosha using easy install script, you can access the cli commands by running

```bash
marzgosha cli [OPTIONS] COMMAND [ARGS]...
```

For more information, You can read [MarzGosha CLI's documentation](./cli/README.md).

# MarzGosha Node

The MarzGosha project introduces the [MarzGosha-node](https://github.com/gfwfuckers/marzgosha-node), which revolutionizes infrastructure distribution. With MarzGosha-node, you can distribute your infrastructure across multiple locations, unlocking benefits such as redundancy, high availability, scalability, flexibility. MarzGosha-node empowers users to connect to different servers, offering them the flexibility to choose and connect to multiple servers instead of being limited to only one server.
For more detailed information and installation instructions, please refer to the [MarzGosha-node official documentation](https://github.com/gfwfuckers/marzgosha-node)

# Webhook notifications

You can set a webhook address and MarzGosha will send the notifications to that address.

the requests will be sent as a post request to the adress provided by `WEBHOOK_ADDRESS` with `WEBHOOK_SECRET` as `x-webhook-secret` in the headers.

Example request sent from MarzGosha:

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
{"username": "marzgosha_test_user", "action": "user_updated", "enqueued_at": 1680506457.636369, "tries": 0}
```

Different action typs are: `user_created`, `user_updated`, `user_deleted`, `user_limited`, `user_expired`, `user_disabled`, `user_enabled`

# Donation

If you found MarzGosha useful and would like to support its development, you can make a donation in one of the following crypto networks:

- TRON network (TRC20): `TCYj3X9r9s7Fd45LCdFYUdjdg812ogNidf`
- ETH, BNB, MATIC network (ERC20, BEP20): `0x03ebDa025D639Cf46f9926cdd7402253C9De7f38`
- Bitcoin network: `bc1qvm4tstzsyrkvg9yv83ma92d9sydet6sa807ytt`
- Dogecoin network: `DSFfmESjw4whX77kbaGeNx1YTX4ZuhZcsw`
- TON network: `EQCUfz9BqiDHkpJtSJ7XMFec0tSdNmbcgutTC2zuAh_wQtmG`

Thank you for your support!

# License

Made in [Unknown!] and Published under [AGPL-3.0](./LICENSE).

# Contributors

We ❤️‍🔥 contributors! If you'd like to contribute, please check out our [Contributing Guidelines](CONTRIBUTING.md) and feel free to submit a pull request or open an issue. We also welcome you to join our [Telegram](https://t.me/gfwfuckers_marzgosha) group for either support or contributing guidance.

Check [open issues](https://github.com/gfwfuckers/marzgosha/issues) to help the progress of this project.

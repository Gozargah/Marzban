<p align="center">
  <a href="https://github.com/gozargah/marzban" target="_blank" rel="noopener noreferrer">
    <picture>
      <source media="(prefers-color-scheme: dark)" srcset="https://github.com/Gozargah/Marzban-docs/raw/master/screenshots/logo-dark.png">
      <img width="160" height="160" src="https://github.com/Gozargah/Marzban-docs/raw/master/screenshots/logo-light.png">
    </picture>
  </a>
</p>

<h1 align="center"/>Marzban</h1>

<p align="center">
    Unified GUI Censorship Resistant Solution Powered by <a href="https://github.com/XTLS/Xray-core">Xray</a>
</p>

<br/>
<p align="center">
    <a href="#">
        <img src="https://img.shields.io/github/actions/workflow/status/gozargah/marzban/build.yml?style=flat-square" />
    </a>
    <a href="https://hub.docker.com/r/gozargah/marzban" target="_blank">
        <img src="https://img.shields.io/docker/pulls/gozargah/marzban?style=flat-square&logo=docker" />
    </a>
    <a href="#">
        <img src="https://img.shields.io/github/license/gozargah/marzban?style=flat-square" />
    </a>
    <a href="https://t.me/gozargah_marzban" target="_blank">
        <img src="https://img.shields.io/badge/telegram-group-blue?style=flat-square&logo=telegram" />
    </a>
    <a href="#">
        <img src="https://img.shields.io/badge/twitter-commiunity-blue?style=flat-square&logo=twitter" />
    </a>
    <a href="#">
        <img src="https://img.shields.io/github/stars/gozargah/marzban?style=social" />
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
</p>

<p align="center">
  <a href="httpps://github.com/gozargah/marzban" target="_blank" rel="noopener noreferrer" >
    <img src="https://github.com/Gozargah/Marzban-docs/raw/master/screenshots/preview.png" alt="Marzban screenshots" width="600" height="auto">
  </a>
</p>


## Table of Contents
- [Overview](#overview)
  - [Why using Marzban?](#why-using-marzban)
    - [Features](#features)
- [Installation guide](#installation-guide)
  - [Install with docker (recommended)](#install-with-docker-recommended)
  - [Manual install (advanced)](#manual-install-advanced)
- [Configuration](#configuration)
- [How to use API](#how-to-use-api)
- [How to Backup Marzban](#how-to-backup-marzban)
- [Telegram Bot](#telegram-bot)
- [Marzban CLI](#marzban-cli)
- [Donation](#donation)
- [License](#license)
- [Contributors](#contributors)


# Overview

Marzban (the Persian word for "border guard" - pronounced /mærz'ban/) is a proxy management tool that provides a simple and easy-to-use user interface for managing hundreds of proxy accounts powered by [Xray-core](https://github.com/XTLS/Xray-core) and built using Python and Reactjs.


## Why using Marzban?

Marzban is user-friendly, feature-rich and reliable. It lets you to create different proxies for your users without any complicated configuration. Using its built-in web UI, you are able to monitor, modify and limit users.

### Features

- Built-in **Web UI**
- Fully **REST API** backend
- Supports protocols **Vmess**, **VLESS**, **Trojan** and **Shadowsocks**
- **Multi-protocol** for a single user
- **Multi-user** on a single inbound
- **Multi-inbound** on a **single port** (using fallbacks)
- **Traffic** and **expiry date** limitations
- **Periodic** traffic limit (e.g. daily, weekly, etc.)
- **Subscription link** compatible with **V2ray** _(such as V2RayNG, OneClick, Nekoray, etc.)_ and **Clash**
- Automated **Share link** and **QRcode** generator
- System monitoring and **traffic statistics**
- Customizable xray configuration
- **TLS** support
- Integrated **Telegram Bot**
- Integrated **Command Line Interface (CLI)**
- **Multi-admin** support (WIP)

# Installation guide

> We stronly recommend use our Docker images to run on production. It's easier to maintain and upgrade.

## Install with docker (recommended)

We've made some pre-built docker configurations based on different needs. To run this app using docker, [please read our instruction here](https://github.com/Gozargah/Marzban-examples).

You have the option to choose one of setups as you wish. such:
- [fully-single-port](https://github.com/Gozargah/Marzban-examples/tree/master/fully-single-port/)
- [single-port-proxy](https://github.com/Gozargah/Marzban-examples/tree/master/single-port-proxy/)
- [multi-port](https://github.com/Gozargah/Marzban-examples/tree/master/multi-port/)

## Manual install (advanced)

Install xray on your machine

You can install it using [Xray-install](https://github.com/XTLS/Xray-install)

```bash
bash -c "$(curl -L https://github.com/XTLS/Xray-install/raw/main/install-release.sh)" @ install
```

Clone the project and install the dependencies.

You need Python>=3.8

```bash
git clone https://github.com/Gozargah/Marzban.git
cd Marzban
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
marzban-cli --install-completion
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

By default the app will be run on `http://localhost:8000/dashboard`. You can configure it using changing the `UVICORN_HOST` and `UVICORN_PORT` environment variables.

# Configuration

> You can set settings below using environment variables or placing them in `env` or `.env` file.

| Variable                        | Description                                                                                           |
| ------------------------------- | ----------------------------------------------------------------------------------------------------- |
| SUDO_USERNAME                   | Superuser's username |
| SUDO_PASSWORD                   | Superuser's password |
| SQLALCHEMY_DATABASE_URL         | Database URL ([SQLAlchemy's docs](https://docs.sqlalchemy.org/en/20/core/engines.html#database-urls)) |
| UVICORN_HOST                    | Bind application to this host (default: `0.0.0.0`)                                                    |
| UVICORN_PORT                    | Bind application to this port (default: `8000`)                                                       |
| UVICORN_UDS                     | Bind application to a UNIX domain socket                                                              |
| UVICORN_SSL_CERTFILE            | SSL certificate file to have application on https                                                     |
| UVICORN_SSL_KEYFILE             | SSL key file to have application on https                                                             |
| XRAY_JSON                       | Path of Xray's json config file (default: `xray.json`)                                                |
| XRAY_EXECUTABLE_PATH            | Path of Xray binary (default: `/usr/local/bin/xray`)                                                  |
| XRAY_ASSETS_PATH                | Path of Xray assets (default: `/usr/local/share/xray`)                                                |
| XRAY_SUBSCRIPTION_URL_PREFIX    | Prefix of subscription URLs                                                                           |
| XRAY_FALLBACKS_INBOUND_TAG      | Tag of the inbound that includes fallbacks, needed in the case you're using fallbacks                 |
| XRAY_EXCLUDE_INBOUND_TAGS       | Tags of the inbounds that shouldn't be managed and included in links by application                   |
| TELEGRAM_API_TOKEN              | Telegram bot API token  (get token from [@botfather](https://t.me/botfather))                         |
| TELEGRAM_ADMIN_ID               | Numeric Telegram ID of admin (use [@userinfobot](https://t.me/userinfobot) to found your ID)          |
| TELEGRAM_PROXY_URL              | Run Telegram Bot over proxy                                                                           |
| JWT_ACCESS_TOKEN_EXPIRE_MINUTES | Expire time for the Access Tokens in minutes, `0` considered as infinite (default: `1440`)            |
| DOCS                            | Whether API documents should be available on `/docs` and `/redoc` or not (default: `False`)           |
| DEBUG                           | Debug mode for development (default: `False`)                                                         |


# How to use API
Marzban provides a REST API that enables developers to interact with Marzban services programmatically. To view the API documentation in Swagger UI or ReDoc, set the configuration variable `DOCS=True` and navigate to the `/docs` and `/redoc`.


# How to Backup Marzban
It's always a good idea to backup your Marzban files regularly to prevent data loss in case of system failures or accidental deletion. Here are the steps to backup Marzban:

1. By default, all Marzban important files are saved in `/var/lib/marzban` (Docker versions). Copy the entire `/var/lib/marzban` directory to a backup location of your choice, such as an external hard drive or cloud storage.
2. Additionally, make sure to backup your env file, which contains your configuration variables, and also, your Xray config file.

By following these steps, you can ensure that you have a backup of all your Marzban files and data, as well as your configuration variables and Xray configuration, in case you need to restore them in the future. Remember to update your backups regularly to keep them up-to-date.


# Telegram Bot
Marzban comes with an integrated Telegram bot that can handle server management, user creation and removal, and send notifications. This bot can be easily enabled by following a few simple steps, and it provides a convenient way to interact with Marzban without having to log in to the server every time.

To enable Telegram Bot:

1. set `TELEGRAM_API_TOKEN` to your bot's API Token
2. set `TELEGRAM_ADMIN_ID` to your Telegram account's numeric ID, you can get your ID from [@userinfobot](https://t.me/userinfobot)


# Marzban CLI
Marzban comes with an integrated CLI named `marzban-cli` which allows administrators to have direct interaction with it.

If you use docker for Marzban, you should use `docker exec` or `docker-compose exec` to access the container's interactive shell.

For example, navigate to marzban's `docker-compose.yml` directory and run the following command:

```bash
$ sudo docker-compose exec -it marzban bash
```

The Marzban CLI will be accessible through `marzban-cli` command anywhere!

For more information, You can read [Marzban CLI's documentation](./cli/README.md).


# Donation
If you found Marzban useful and would like to support its development, you can make a donation in one of the following crypto networks:

- TRON (TRX) network: `TX8kJoDcowQPBFTYHAJR36GyoUKP1Xwzkb`
- ETH, BNB, MATIC network: `0xFdc9ad32454FA4fc4733270FCc12ddBFb68b83F7`
- Bitcoin network: `bc1qpys2nefgsjjgae3g3gqy9crsv3h3rm96tlkz0v`
- Dogecoin network: `DJAocBAu8y6LwhDKUktLAyzV8xyoFeHH6R`


Thank you for your support!


# License

Made in [Unknown!] and Published under [AGPL-3.0](./LICENSE).


# Contributors

We ❤️‍🔥 contributors! If you'd like to contribute, please check out our [Contributing Guidelines](CONTRIBUTING.md) and feel free to submit a pull request or open an issue. We also welcome you to join our [Telegram](https://t.me/gozargah_marzban) group for either support or contributing guidance.

Check [open issues](https://github.com/gozargah/marzban/issues) to help the progress of this project.



<p align="center">
Thanks to the all contributors who have helped improve Marzban:
</p>
<p align="center">
<a href="https://github.com/Gozargah/Marzban/graphs/contributors">
  <img src="https://contrib.rocks/image?repo=Gozargah/Marzban" />
</a>
</p>
<p align="center">
  Made with <a rel="noopener noreferrer" target="_blank" href="https://contrib.rocks">contrib.rocks</a>
</p>


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
    <a href="#">
        <img src="https://img.shields.io/docker/pulls/gozargah/marzban?style=flat-square&logo=docker" />
    </a>
    <a href="#">
        <img src="https://img.shields.io/github/license/gozargah/marzban?style=flat-square" />
    </a>
    <a href="#">
        <img src="https://img.shields.io/badge/telegram-group-blue?style=flat-square&logo=telegram" />
    </a>
    <a href="#">
        <img src="https://img.shields.io/badge/twitter-commiunity-blue?style=flat-square&logo=twitter" />
    </a>
    <a>
        <img src="https://img.shields.io/github/stars/gozargah/marzban?style=social" />
    </a>
</p>
<br/>

<p align="center">
  <a href="httpps://github.com/gozargah/marzban" target="_blank" rel="noopener noreferrer" >
    <img src="https://github.com/Gozargah/Marzban-docs/raw/master/screenshots/preview.png" alt="Elk screenshots" width="600" height="auto">
  </a>
</p>

## Overview

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

- Traffic and expiry date limitations

- **Subscription link** compatible with **V2ray** _(such as V2RayNG, OneClick, Nekoray, etc.)_ and **Clash**

- Automated **Share link** and **QRcode** generator

- System monitoring and **traffic statistics**

- Customizable xray configuration

- **TLS** support

- **Multi-admin** support (WIP)

# Installation guide

We stronly recommend use our Docker images to run on production. It's easier to maintaine and upgrade.

## Install with docker

We've made some prebuilt docker configurations based on different needs. To run this app using docker, [please read our instruction here](https://github.com/Gozargah/Marzban-examples).

## Manual install

Install xray on your machine
You can install it using [Xray-install](https://github.com/XTLS/Xray-install)

```bash
bash -c "$(curl -L https://github.com/XTLS/Xray-install/raw/main/install-release.sh)" @ install
```

Clone the project and install the dependencies. You need Python>=3.8 as a minimum

```bash
git clone https://github.com/Gozargah/Marzban.git
cd Marzban
python3 -m pip install -r requirements.txt
```

Alternatively, to have an isolated environment you can use [Python Virtualenv](https://pypi.org/project/virtualenv/)

Then run the following command to run the database migration scripts

```bash
alembic upgrade head
```

Now it's time to configuration
Make a copy of `.env.example` file, take a look and edit it using a text editor like `nano`.
You probably like to modify the admin credentials.

```bash
cp .env.example .env
nano .env
```

Eventually, launch the application using command below

```bash
python3 main.py
```

My default the app will be run on `http://localhost:8000/dashboard`. You can configure it using changing the `UVICORN_HOST` and `UVICORN_PORT` environment variables.

Check [configurations](#Configurations) section for more information

### Marzban is young and under development

Check [open issues](https://github.com/gozargah/marzban/issues) to help the progress of this project.

Also please share [your ideas](https://github.com/Gozargah/Marzban/issues/new?assignees=&labels=enhancement&template=feature_request.md&title=Feature+title)!

If this project has helped you in any way, we will be happy if you help us to continue the maintenance of this project by [donation]().

## License

Made in [Unknown!] and Published under [AGPL-3.0](./LICENSE).

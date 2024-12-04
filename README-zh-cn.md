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
  <a href="https://github.com/gozargah/marzban" target="_blank" rel="noopener noreferrer" >
    <img src="https://github.com/Gozargah/Marzban-docs/raw/master/screenshots/preview.png" alt="Marzban screenshots" width="600" height="auto">
  </a>
</p>


## 目录
- [概览](#概览)
  - [为什么要使用 Marzban?](#为什么要使用-marzban)
    - [特性](#特性)
- [安装指南](#安装指南)
- [配置](#配置)
- [文档](#文档)
- [如何使用 API](#如何使用-api)
- [如何备份 Marzban](#如何备份-marzban)
- [Telegram bot](#telegram-bot)
- [捐赠](#捐赠)
- [许可](#许可)
- [贡献者](#贡献者)


# 概览

Marzban（Marzban一词源自波斯语，意为“边境警卫”，发音为 /mærz'ban/）是一个代理管理工具，提供简单易用的用户界面，可管理数百个代理账户，由 [Xray-core](https://github.com/XTLS/Xray-core) 提供支持，使用 Python 和 Reactjs 构建。



## 为什么要使用 Marzban?

Marzban 是一个用户友好、功能丰富且可靠的工具。它让您可以为用户创建不同的代理，无需进行任何复杂的配置。通过其内置的 Web 界面，您可以监视、修改和限制用户。

### 特性

- 内置 **Web 界面**
- 完全支持 **REST API** 的后端
- 支持 **Vmess**、**VLESS**、**Trojan** 和 **Shadowsocks** 协议
- 单用户的**多协议**支持
- 单入站的**多用户**支持
- 单端口的**多入站**支持（使用 fallbacks）
- **流量**和**过期日期**限制
- 周期性的流量限制（例如每天、每周等）
- 兼容 **V2ray** 的**订阅链接**（例如 V2RayNG、SingBox、Nekoray 等）和 **Clash**
- 自动化的**分享链接**和**二维码**生成器
- 系统监控和**流量统计**
- 可自定义的 xray 配置
- **TLS** 支持
- 集成的 **Telegram Bot**
- **多管理员**支持（WIP）


# 安装指南
运行以下命令以使用 SQLite 数据库安装 Marzban。

```bash
sudo bash -c "$(curl -sL https://github.com/Gozargah/Marzban-scripts/raw/master/marzban.sh)" @ install
```

运行以下命令以使用 MySQL 数据库安装 Marzban。

```bash
sudo bash -c "$(curl -sL https://github.com/Gozargah/Marzban-scripts/raw/master/marzban.sh)" @ install --database mysql
```

运行以下命令以使用 MariaDB 数据库安装 Marzban。
```bash
sudo bash -c "$(curl -sL https://github.com/Gozargah/Marzban-scripts/raw/master/marzban.sh)" @ install --database mariadb
```

Once the installation is complete:

- You will see the logs that you can stop watching them by closing the terminal or pressing `Ctrl+C`
- The Marzban files will be located at `/opt/marzban`
- The configuration file can be found at `/opt/marzban/.env` (refer to [configurations](#configuration) section to see variables)
- The data files will be placed at `/usr/lib/marzban`
- For security reasons, the Marzban dashboard is not accessible via IP address. Therefore, you must [obtain SSL certificate](https://gozargah.github.io/marzban/en/examples/issue-ssl-certificate) and access your Marzban dashboard by opening a web browser and navigating to `https://YOUR_DOMAIN:8000/dashboard/` (replace YOUR_DOMAIN with your actual domain)
- You can also use SSH port forwarding to access the Marzban dashboard locally without a domain. Replace `user@serverip` with your actual SSH username and server IP and Run the command below:

```bash
ssh -L 8000:localhost:8000 user@serverip
```

Finally, you can enter the following link in your browser to access your Marzban dashboard:

http://localhost:8000/dashboard/

You will lose access to the dashboard as soon as you close the SSH terminal. Therefore, this method is recommended only for testing purposes.

Next, you need to create a sudo admin for logging into the Marzban dashboard by the following command

```bash
marzban cli admin create --sudo
```

That's it! You can login to your dashboard using these credentials

To see the help message of the Marzban script, run the following command

```bash
marzban --help
```

If you are eager to run the project using the source code, check the section below
<details markdown="1">
<summary><h3>手动安装（高级）</h3></summary>

在您的机器上安装 xray

您可以使用 [Xray-install](https://github.com/XTLS/Xray-install) 脚本进行安装：

```bash
bash -c "$(curl -L https://github.com/XTLS/Xray-install/raw/main/install-release.sh)" @ install
```

克隆项目并安装依赖项。

您需要 Python>=3.8 版本。

```bash
git clone https://github.com/Gozargah/Marzban.git
cd Marzban
wget -qO- https://bootstrap.pypa.io/get-pip.py | python3 -
python3 -m pip install -r requirements.txt
```

另外，为了拥有一个隔离的环境，您可以使用 [Python Virtualenv](https://pypi.org/project/virtualenv/)。

然后运行以下命令运行数据库迁移脚本：

```bash
alembic upgrade head
```

现在开始配置：

复制 `.env.example` 文件，查看并使用文本编辑器（如`nano`）进行编辑。

您可能想要修改管理员凭据。

```bash
cp .env.example .env
nano .env
```

> 请查看[配置](#配置)部分以获取更多信息。

最终，使用以下命令启动应用程序：

```bash
python3 main.py
```

也可使用 linux systemctl 启动：
```
systemctl enable /var/lib/marzban/marzban.service
systemctl start marzban
```

配合 nginx 使用：
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
    # client ws-path: /marzban/me/2087
    #
    # 所有流量通过 443 端口进行代理，然后分发至真正的 xray 端口（2087、2088 等等）。
    # 路径中的 “/marzban” 可以改为任意合法 URL 字符.
    #
    # /${path}/${username}/${xray-port}
    location ~* /marzban/.+/(.+)$ {
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
或
```
server {
    listen 443 ssl http2;
    listen [::]:443 ssl http2;
    server_name  marzban.example.com;

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

默认情况下，应用将在 `http://localhost:8000/dashboard` 上运行。您可以通过更改 `UVICORN_HOST` 和 `UVICORN_PORT` 环境变量来进行配置。
</details>

# 配置

> 您可以使用环境变量或将其放置在 `env` 或 `.env` 文件中来设置以下设置。

| 变量                                     | 描述                                                                                                                      |
| ---------------------------------------- |-------------------------------------------------------------------------------------------------------------------------|
| SUDO_USERNAME                            | 管理员用户名（默认: admin）                                                                                                       |
| SUDO_PASSWORD                            | 管理员密码（默认: admin）                                                                                                        |
| SQLALCHEMY_DATABASE_URL                  | 数据库文档（[SQLAlchemy's docs](https://docs.sqlalchemy.org/en/20/core/engines.html#database-urls)）                           |
| UVICORN_HOST                             | 绑定应用程序到此主机（默认为 `0.0.0.0`）                                                                                               |
| UVICORN_PORT                             | 绑定应用程序到此端口（默认为 `8000`）                                                                                                  |
| UVICORN_UDS                              | 将应用程序绑定到一个 UNIX 域套接字                                                                                                    |
| UVICORN_SSL_CERTFILE                     | SSL 证书文件路径                                                                                                              |
| UVICORN_SSL_KEYFILE                      | SSL 密钥文件路径                                                                                                              |
| UVICORN_SSL_CA_TYPE                      | 授权 SSL 证书的类型。使用“private”来测试自签名 CA（默认值：`public`）                                                                          |
| XRAY_JSON                                | Xray 的 json 配置文件路径（默认: `xray_config.json`）                                                                              |
| XRAY_EXECUTABLE_PATH                     | Xray 的执行程序路径: `/usr/local/bin/xray`）                                                                                    |
| XRAY_ASSETS_PATH                         | Xray 的资源目录: `/usr/local/share/xray`）                                                                                    |
| XRAY_SUBSCRIPTION_URL_PREFIX             | 订阅URL的前缀                                                                                                                |
| XRAY_FALLBACKS_INBOUND_TAG               | 包含 fallbacks 的入站标记, 在您需要使用 fallbacks 配置此项                                                                               |
| XRAY_EXCLUDE_INBOUND_TAGS                | 不需要此应用程序管理或在链接中包含的入站标记                                                                                                  |
| CLASH_SUBSCRIPTION_TEMPLATE              | 将用于生成冲突配置的模板（默认值：`clash/default.yml`）                                                                                   |
| SUBSCRIPTION_PAGE_TEMPLATE               | 用于生成订阅信息页面的模板（默认：`subscription/index.html`）                                                                             |
| HOME_PAGE_TEMPLATE                       | 诱饵页面模板（默认：`home/index.html`）                                                                                            |
| TELEGRAM_API_TOKEN                       | Telegram bot API 令牌（可以从 [@botfather](https://t.me/botfather) 获取）                                                        |
| TELEGRAM_ADMIN_ID                        | 管理员的 Telegram ID（可以使用 [@userinfobot](https://t.me/userinfobot) 查找您的 ID）                                                 |
| TELEGRAM_PROXY_URL                       | 在代理下运行 Telegram bot。                                                                                                    |
| JWT_ACCESS_TOKEN_EXPIRE_MINUTES          | Access Tokens 的过期时间，以分钟为单位，`0` 表示无限期（默认为 `1440` 分钟）                                                                     |
| DOCS                                     | API 文档是否应该在 `/docs` 和 `/redoc` 上提供（默认为 `False`                                                                          |
| DEBUG                                    | Debug mode for development (default: `False`)                                                                           |
| WEBHOOK_ADDRESS                          | Webhook address to send notifications to. Webhook notifications will be sent if this value was set.                     |
| WEBHOOK_SECRET                           | Webhook secret will be sent with each request as `x-webhook-secret` in the header (default: `None`)                     |
| NUMBER_OF_RECURRENT_NOTIFICATIONS        | How many times to retry if an error detected in sending a notification (default: `3`)                                   |
| RECURRENT_NOTIFICATIONS_TIMEOUT          | Timeout between each retry if an error detected in sending a notification in seconds (default: `180`)                   |
| NOTIFY_REACHED_USAGE_PERCENT             | At which percentage of usage to send the warning notification (default: `80`)                                           |
| NOTIFY_DAYS_LEFT                         | When to send warning notifaction about expiration (default: `3`)                                                        |
| USERS_AUTODELETE_DAYS                    | Delete expired (and optionally limited users) after this many days (Negative values disable this feature, default: `-1`) |
| USER_AUTODELETE_INCLUDE_LIMITED_ACCOUNTS | Weather to include limited accounts in the auto-delete feature (default: `False`)                                       |
| USE_CUSTOM_JSON_DEFAULT                  | Enable custom JSON config for ALL supported clients (default: `False`)                                                  |
| USE_CUSTOM_JSON_FOR_V2RAYNG              | Enable custom JSON config only for V2rayNG (default: `False`)                                                           |
| USE_CUSTOM_JSON_FOR_STREISAND            | Enable custom JSON config only for Streisand (default: `False`)                                                         |
| USE_CUSTOM_JSON_FOR_V2RAYN               | Enable custom JSON config only for V2rayN (default: `False`)                                                            |


# 文档
[Marzban 文档](https://gozargah.github.io/marzban) 提供了所有必要的入门指南，支持三种语言：波斯语、英语和俄语。要全面覆盖项目的各个方面，这些文档需要大量的工作。我们欢迎并感谢您的贡献，以帮助我们改进文档。您可以在这个 [GitHub 仓库](https://github.com/Gozargah/gozargah.github.io) 中进行贡献。


# 如何使用 API
Marzban 提供了 REST API，使开发人员能够以编程方式与 Marzban 服务进行交互。要在 Swagger UI 或 ReDoc 中查看 API 文档，设置配置变量 `DOCS=True`，然后导航到 `/docs` 和 `/redoc`。


# 如何备份 Marzban

定期备份 Marzban 文件是预防系统故障或意外删除导致数据丢失的好习惯。以下是备份 Marzban 的步骤：

1. 默认情况下，所有重要的 Marzban 文件都保存在 `/var/lib/marzban` ( Docker 版本)中。将整个 `/var/lib/marzban` 目录复制到您选择的备份位置，比如外部硬盘或云存储。
2. 此外，请确保备份您的 `env` 文件，其中包含您的配置变量，以及您的 `Xray` 配置文件。

Marzban 的备份服务会高效地压缩所有必要文件并将它们发送到您指定的 Telegram 机器人。它支持 SQLite、MySQL 和 MariaDB 数据库。其一个主要功能是自动化，允许您每小时安排一次备份。对于 Telegram 机器人的上传限制没有限制；如果文件超过限制，它会被拆分并以多个部分发送。此外，您可以在任何时间启动即时备份。

安装最新版 Marzban 命令：
```bash
sudo bash -c "$(curl -sL https://github.com/Gozargah/Marzban-scripts/raw/master/marzban.sh)" @ install-script
```

设置备份服务：
```bash
marzban backup-service
```

获取即时备份：
```bash
marzban backup
```

按照这些步骤，您可以确保有备份所有 Marzban 文件和数据，以及您的配置变量和 Xray 配置，以备将来恢复使用。请记得定期更新备份，以保持它们的最新性。


# Telegram bot

Marzban 配备了一个集成的 Telegram bot，可以处理服务器管理、用户创建和删除，以及发送通知。通过几个简单的步骤，您可以轻松地启用这个机器人，并提供了一种方便的方式与 Marzban 交互，而不需要每次都登录到服务器上。

启用 Telegram bot：

1. 将 `TELEGRAM_API_TOKEN` 设置为您的 bot API Token。
2. 将 `TELEGRAM_ADMIN_ID` 设置为您的 Telegram ID，您可以从 [@userinfobot](https://t.me/userinfobot) 中获取自己的 ID。


# 捐赠

如果您认为 Marzban 有用，并想支持其发展，可以在以下加密网络之一进行捐赠：

- TRON(TRX) 网络：`TX8kJoDcowQPBFTYHAJR36GyoUKP1Xwzkb`
- ETH、BNB、MATIC 网络：`0xFdc9ad32454FA4fc4733270FCc12ddBFb68b83F7`
- 比特币网络：`bc1qpys2nefgsjjgae3g3gqy9crsv3h3rm96tlkz0v`
- Dogecoin 网络：`DJAocBAu8y6LwhDKUktLAyzV8xyoFeHH6R`
- TON 网络：`EQAVf-7hAXHlF-jmrKE44oBwN7HGQFVBLAtrOsev5K4qR4P8`


感谢您的支持！

# 许可

制作于 [Unknown!] 并在 [AGPL-3.0](./LICENSE) 下发布。

# 贡献者

我们热爱贡献者！如果您想做出贡献，请查看我们的[贡献指南](CONTRIBUTING.md)并随时提交拉取请求或打开问题。我们也欢迎您加入我们的 [Telegram](https://t.me/gozargah_marzban) 群组，以获得支持或贡献指导。

查看 [issues](https://github.com/gozargah/marzban/issues) 以帮助改进这个项目。



<p align="center">
感谢所有为改善 Marzban 做出贡献的贡献者们：
</p>
<p align="center">
<a href="https://github.com/Gozargah/Marzban/graphs/contributors">
  <img src="https://contrib.rocks/image?repo=Gozargah/Marzban" />
</a>
</p>
<p align="center">
  Made with <a rel="noopener noreferrer" target="_blank" href="https://contrib.rocks">contrib.rocks</a>
</p>


# npvpn panel

[English](README-en.md) · [Релизы](https://github.com/npvpn/vpn-panel/releases) · [Docker Hub](https://hub.docker.com/r/npvpn/panel) · [Лицензия](LICENSE)

**npvpn panel** — форк Marzban, разработанный для реальных коммерческих VPN-проектов.  
Панель оптимизирована под масштабируемые конфигурации, высокую производительность и удобное управление распределённой инфраструктурой.  
Проект развивается как основа для запуска VPN-сервисов и автоматизированных Telegram-ботов.

---

## Назначение

- Масштабируемая архитектура для больших VPN-проектов  
- Оптимизация производительности и стабильности  
- Поддержка реальных боевых конфигураций (VLESS, XRay, multi-node)  
- Упрощённая работа с узлами и серверами  
- Интеграция с Telegram-ботами npvpn  
- Подходит для бизнеса, партнёрских сервисов и white-label решений

---

## Чем отличается от Marzban

- **Роли нод и каскад.** Нода может быть входной (entry), выходной (exit) или обычной (direct); каскадные части конфига xray панель добавляет сама. Подробнее: [docs/cascade-node-roles.md](docs/cascade-node-roles.md).
- **Месячный лимит трафика для отдельных нод (БС-нод).** Счётчик ведётся по месяцам и сбрасывается при смене месяца; при превышении лимита клиенты блокируются на ноде.
- **Хосты с несколькими адресами и балансировка.** Хост, связанный с несколькими нодами, отдаётся в подписке v2ray-json одним конфигом с балансировщиком xray.
- **Редактор шаблонов xray.** Шаблоны конфигурации хранятся в панели с версиями и редактируются через API и дашборд.
- **Кэш конфигов нод.** Готовая JSON-строка конфига каждой ноды кэшируется на время одной волны переподключения, что снижает нагрузку при массовом переподключении нод.

---

## Установка

### Обычная установка

**SQLite** — без SSL, панель на порту 8000.

```bash
sudo bash -c "$(curl -sL https://github.com/npvpn/Marzban-scripts/raw/master/marzban.sh)" @ install
```

Скрипт задаст два вопроса: название подписки в клиенте и username Telegram-бота (можно оставить оба пустыми — Enter). Ссылку на поддержку скрипт не спрашивает: пока она не задана, ссылка поддержки в подписке указывает на `https://t.me/` (пустая ссылка). Задайте её позже в `/opt/marzban/.env` (`SUB_SUPPORT_URL`) и выполните `marzban restart`.

Установка всегда заканчивается показом логов панели, если не указан `--no-logs`. Нажмите Ctrl+C — это не останавливает панель.

После установки создайте администратора:

```bash
marzban cli admin create
```

Команда спросит логин, «Is sudo [y/N]» (для главного администратора ответьте `y`), пароль с подтверждением, а также необязательные Telegram ID и Discord webhook.

Войдите по адресу `http://<IP или домен>:8000/dashboard/#/login`.

**MySQL / MariaDB** — автоматические Let's Encrypt, volumes сертификатов в compose, HTTPS на порту 8001. UFW, админ панели и GitHub runner не ставятся (это только `install-partner`).

Перед запуском: A-запись домена на IP сервера, порт 80 свободен (certbot standalone), Debian/Ubuntu.

Интерактивно (скрипт спросит домен и email для Let's Encrypt):

```bash
sudo bash -c "$(curl -sL https://github.com/npvpn/Marzban-scripts/raw/master/marzban.sh)" @ install --database mysql
```

```bash
sudo bash -c "$(curl -sL https://github.com/npvpn/Marzban-scripts/raw/master/marzban.sh)" @ install --database mariadb
```

С параметрами:

```bash
sudo bash -c "$(curl -sL https://github.com/npvpn/Marzban-scripts/raw/master/marzban.sh)" @ install --database mysql \
  --domain panel.example.com \
  --cert-email admin@example.com \
  --non-interactive
```

Опционально: `--uvicorn-port 8001`, `--skip-dns-check`, `--skip-cert` (сертификаты уже лежат в `/etc/letsencrypt/live/<домен>/`), `--no-logs`.

Установка всегда заканчивается показом логов панели, если не указан `--no-logs`; Ctrl+C возвращает управление и не останавливает панель. С `--non-interactive` название подписки, ссылка бота и ссылка поддержки остаются значениями по умолчанию; их можно поменять позже в `/opt/marzban/.env` (`SUB_PROFILE_TITLE`, `BOT_URL`, `SUB_SUPPORT_URL`) и применить командой `marzban restart`.

После установки создайте администратора:

```bash
marzban cli admin create
```

Команда спросит логин, «Is sudo [y/N]» (для главного администратора ответьте `y`), пароль с подтверждением, а также необязательные Telegram ID и Discord webhook.

Войдите по адресу `https://<домен>:8001/dashboard/`.

---

### Обновление с оригинальной панели

Если панель была установлена из оригинального репозитория Marzban, вы можете переключить её на `npvpn panel` без переустановки:

1. Подключитесь к серверу, где установлена панель.
2. Откройте `docker-compose`:

```bash
marzban edit
```

3. В сервисе `marzban` укажите образ `npvpn/panel:latest` и проверьте блок `volumes`:

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
      # если панель отдаёт HTTPS — каталог с сертификатами:
      # - /etc/letsencrypt:/etc/letsencrypt:ro
```

Блок `depends_on` на сервис `mysql` оставляйте, только если в вашем текущем файле уже есть сервис `mysql` (MySQL/MariaDB-установка); для SQLite его добавлять не нужно. Если сертификаты лежат не в `/etc/letsencrypt`, смонтируйте свои пути — пути внутри контейнера должны совпадать с `UVICORN_SSL_CERTFILE` и `UVICORN_SSL_KEYFILE` в `.env`.

4. Загрузите новый образ:

```bash
docker pull npvpn/panel:latest
```

5. Перезапустите панель:

```bash
marzban restart
```

---

### Партнёрская установка

Для партнёров npvpn есть автоматическая установка с выпуском сертификата и настройкой сервера: [docs/partner-install.md](docs/partner-install.md).

---

## Установка ноды

### Обновление оригинальной ноды

Мигрировать уже установленную ноду (Watchtower, conntrack, node_exporter).

```bash
sudo bash -c "$(curl -sL https://github.com/npvpn/Marzban-scripts/raw/master/marzban-node.sh)" @ migrate
```

Если нода используется с ботом npvpn, передайте публичный IP сервера бота — тогда `:9100` откроется только ему:

```bash
sudo bash -c "$(curl -sL https://github.com/npvpn/Marzban-scripts/raw/master/marzban-node.sh)" @ migrate --bot-server-ip 1.2.3.4
```

Подробнее: [Marzban-scripts/README.md](https://github.com/npvpn/Marzban-scripts/blob/master/README.md).

---

### Новая установка

На отдельном сервере:

```bash
sudo bash -c "$(curl -sL https://github.com/npvpn/Marzban-scripts/raw/master/marzban-node.sh)" @ install
```

Скрипт интерактивно спросит:

1. **Client Certificate** панели — вставьте PEM целиком (от `-----BEGIN CERTIFICATE-----` до `-----END CERTIFICATE-----`) и нажмите Enter на пустой строке. Сертификат можно взять в дашборде панели: «Настройки узлов» → «Добавить новый узел Marzban» → «Показать сертификат» (или «Скачать сертификат»). Либо через API: `GET /api/node/settings` (поле `certificate`). Скрипт не проверяет сертификат: если вставить его обрезанным, нода будет бесконечно перезапускаться.
2. Использовать ли REST-протокол (по умолчанию да), `SERVICE_PORT` (по умолчанию 62050) и `XRAY_API_PORT` (по умолчанию 62051).
3. IPv4 бота для ограничения `:9100` (см. ниже; пустой ввод — порт останется публичным).

Нода должна быть доступна с панели на `SERVICE_PORT`. После установки добавьте ноду в панели: «Настройки узлов» → «Добавить новый узел Marzban» (адрес сервера, порты 62050 и 62051); статус должен стать `connected`. До добавления ноды в панель на свежей ноде слушает только `SERVICE_PORT` (62050); порт `XRAY_API_PORT` (62051) появляется после запуска ядра xray.

С кастомным именем:

```bash
sudo bash -c "$(curl -sL https://github.com/npvpn/Marzban-scripts/raw/master/marzban-node.sh)" @ install --name marzban-node2
```

Вместе с нодой ставится **node_exporter** (`:9100`, host network) для Prometheus на боте. IP бота от npvpn можно передать сразу — тогда `:9100` откроется только ему (nftables, без включения UFW):

```bash
sudo bash -c "$(curl -sL https://github.com/npvpn/Marzban-scripts/raw/master/marzban-node.sh)" @ install --bot-server-ip 1.2.3.4
```

Без флага скрипт спросит IP интерактивно; пустой ввод — exporter поднимется, порт останется публичным. `--skip-firewall` пропускает ограничение порта.

Только CLI-команда `marzban-node` (без самой ноды):

```bash
sudo bash -c "$(curl -sL https://github.com/npvpn/Marzban-scripts/raw/master/marzban-node.sh)" @ install-script
```

Список команд: `marzban-node help`.

Обновить или сменить версию Xray-core:

```bash
sudo marzban-node core-update
```

---

## Версии и образы

Версии — по дате релиза: `vГГГГ.ММ.ДД`, хотфикс в тот же день — `vГГГГ.ММ.ДД.N`. Образ для версии — `npvpn/panel:ГГГГ.ММ.ДД` (Docker Hub) и `ghcr.io/npvpn/panel:ГГГГ.ММ.ДД`; `latest` указывает на последний релиз. Список изменений — в [релизах](https://github.com/npvpn/vpn-panel/releases).

---

## Разработка

Как собрать проект локально, запустить проверки и прислать изменение — в [CONTRIBUTING.md](CONTRIBUTING.md).

---

## Лицензия

Проект распространяется под лицензией **AGPL-3.0**, как и оригинальный Marzban.  
Это означает, что любые модификации панели, доступные пользователям через сеть, должны быть опубликованы в открытом виде.

Отдельные интеграции (боты, биллинг, API-шлюзы), не включающие код панели, могут использовать другие лицензии.

npvpn panel основан на [Marzban](https://github.com/Gozargah/Marzban) (Gozargah).

---

## Контакты

Баги и предложения — [GitHub Issues](https://github.com/npvpn/vpn-panel/issues). Вопросы — [t.me/npvpn](https://t.me/npvpn).

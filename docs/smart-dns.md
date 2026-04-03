# Smart DNS load balancing

Marzban can answer DNS queries for regional pool hostnames (for example `eu.vpn.example.com`), returning **one node public IP per query** using weighted random selection from nodes that report healthy metrics. Clients keep the same hostname in their subscription; when a node fails, short TTLs and the metrics poller steer new lookups to other nodes.

---

## Быстрый старт (после `marzban update`)

Ниже — минимальный порядок действий на панели и у регистратора. Подставьте свои домены и IP.

### 1. Панель: миграция и зависимости

После **`marzban update`** (или обновления образа Docker) зависимости обычно подтягиваются сами. Если ставите вручную из исходников:

```bash
pip install -r requirements.txt
```

Убедитесь, что есть пакет **`dnslib`** (указан в `requirements.txt`).

**Миграция БД** (колонки `smart_dns_*` у узлов) — если обновление само не применило схему, выполните в том же окружении, где крутится Marzban (часто каталог **`/opt/marzban`**, либо `docker exec` в контейнер панели):

```bash
alembic upgrade head
```

(или команда миграций из вашей инструкции по установке — главное, чтобы ревизия **`e5f6a7b8c9d0`** применилась).

### 2. Панель: фрагмент `.env`

Добавьте в `.env` (или в переменные окружения Docker / systemd), заменив домены и серийник:

```env
SMART_DNS_ENABLED = True
SMART_DNS_BIND_HOST = 0.0.0.0
SMART_DNS_PORT = 53
SMART_DNS_DEFAULT_TTL = 10
SMART_DNS_METRICS_INTERVAL = 3
SMART_DNS_METRICS_TIMEOUT = 2
SMART_DNS_FAIL_THRESHOLD = 3
SMART_DNS_RATE_LIMIT_QPS = 50

# Имя NS в SOA — то же, что будете объявлять у DNS-провайдера; точка в конце желательна
SMART_DNS_SOA_MNAME = ns1.eu.vpn.example.com.
SMART_DNS_SOA_RNAME = hostmaster.example.com.
SMART_DNS_SOA_SERIAL = 2026040301

# Опционально: алерты в дашборде (> 0 включает порог)
SMART_DNS_ALERT_MAX_SCORE = 0
SMART_DNS_ALERT_MAX_CPU = 0
SMART_DNS_ALERT_MAX_BANDWIDTH_MBPS = 0
```

Параллельно для Hysteria на панели (если ноды отдают traffic stats):

```env
HYSTERIA2_TRAFFIC_SECRET = <тот же secret, что trafficStats.secret на нодах>
```

### 3. Панель: порт 53 и перезапуск

- На фаерволе / в облаке откройте **UDP и TCP 53** на IP сервера с Marzban.
- Linux: для прослушивания **:53** обычно нужно **`CAP_NET_BIND_SERVICE`** (Docker: `cap_add`) или запуск от root — см. раздел Docker ниже.
- Убедитесь, что порт 53 не занят (`systemd-resolved` и т.д.; при необходимости отключите или перенастройте).
- Перезапуск:

```bash
marzban restart
# или docker compose restart — как у вас развёрнуто
```

В логах должны появиться строки о старте Smart DNS (поллер и DNS).

### 4. Свой DNS у регистратора

Задача: запросы к имени пула (например **`eu.vpn.example.com`**) шли на **вашу панель**, которая отвечает авторитативно.

1. Выберите FQDN пула — **точно такой же** потом укажете в Marzban в поле узла **`smart_dns_name`**.
2. У DNS-провайдера (Cloudflare как «только DNS», REG.RU, и т.д.):
   - либо создайте **подзону** и пропишите **NS** на имена вроде `ns1.eu.vpn.example.com`, а для них **A-записи на публичный IP панели** (glue);
   - либо используйте схему делегирования, которую поддерживает провайдер, главное — в итоге **авторитативный сервер** для этого имени должен быть **IP вашей панели** (тот, где слушает Smart DNS на 53).
3. Имя из **`SMART_DNS_SOA_MNAME`** должно **резолвиться в IP панели** (часто это тот же `ns1...` с A-записью).

Проверка с вашего ПК (подставьте IP панели и FQDN):

```bash
dig @ПУБЛИЧНЫЙ_IP_ПАНЕЛИ eu.vpn.example.com A
dig @ПУБЛИЧНЫЙ_IP_ПАНЕЛИ eu.vpn.example.com NS
```

Ожидается **NOERROR**, для A — непустой ответ (после настройки узлов в п.5).

### 5. Панель: узлы (Node Settings)

Для **каждого** сервера в одном регионе/пуле:

| Поле | Что указать |
|------|-------------|
| **Smart DNS pool (FQDN)** | Тот же FQDN, что в п.4, напр. `eu.vpn.example.com` |
| **Client-facing IP** | Публичный **IPv4**, который получит клиент. Если пусто — используется **Address** узла (должен быть IPv4 для ответа A) |
| **Address / Port** | Как обычно для связи панели с нодой (REST, порт **62050**) |

Сохраните, дождитесь статуса узла **connected**.

### 6. Marzban-node (после обновления на ветке с `/metrics`)

На каждой ноде:

```bash
pip install -r requirements.txt   # нужен psutil
# при необходимости:
# NODE_METRICS_INTERVAL = 3  в .env ноды
```

Файл **`/var/lib/marzban-node/.env`** на сервере ноды (его подхватывает `docker-compose` образа ноды) должен содержать **`HYSTERIA2_TRAFFIC_SECRET`** — **тот же**, что **`trafficStats.secret`** в `hysteria.yaml` на этой машине. Без этого панель покажет **0 connections / 0 Mbps**, хотя узел будет **UP** (CPU с `psutil` всё равно не ноль). При **`HYSTERIA2_ENABLED=true`** и пустом секрете в логах контейнера ноды будет предупреждение.

Метрики **connections** берутся из **`GET /traffic`** и при необходимости дополняются **`GET /online`** (Hysteria: живые сессии при пустом счётчике байт в `/traffic`).

Если используете Hysteria2 и хотите метрики по трафику: в `hysteria.yaml` — **`trafficStats`** (`listen` + `secret`), на панели тот же **`HYSTERIA2_TRAFFIC_SECRET`**, на ноде при необходимости **`HYSTERIA2_ENABLED=true`**. Порт traffic API откройте **только для IP панели** (или `127.0.0.1`, если опрос только с хоста при `network_mode: host`).

Перезапустите сервис ноды.

### 7. Подписка / клиенты

В шаблоне хоста (Hysteria и др.) укажите **server / SNI = FQDN пула** (`eu.vpn.example.com`), не IP ноды. TLS на нодах должен быть валиден для этого имени (wildcard и т.д.).

### 7a. HAPP: в режиме **TUN** не коннектится, в **прокси** — да (часто один регион)

Обычно это **не баг Marzban**, а разница в том, **как и когда** приложение резолвит имя сервера.

| Режим | Как резолвится адрес из подписки |
|--------|-----------------------------------|
| **Прокси** | DNS идёт через **обычную сеть** (Wi‑Fi / LTE), как у системы до VPN. Имя пула (`germany.example.com`) часто уже отвечает, делегирование с Cloudflare «видно». |
| **TUN (полный туннель)** | После включения туннеля DNS может идти **через VPN**, **Private DNS**, или в момент старта возникает **порядок «сначала DNS — потом туннель»**. Если резолвер не доходит до вашего Smart DNS на панели или отдаёт пустой/чужой ответ, **QUIC к Hysteria не стартует** — в логах клиента это выглядит как таймаут/ошибка только для профиля с **именем пула**. Другие регионы с **прямым IP** в подписке продолжают работать. |

Что проверить:

1. **С телефона** (без VPN): `dig` / онлайн‑чекер — резолвится ли FQDN пула в ожидаемый IPv4.
2. В HAPP: настройки **DNS** в режиме TUN (системный / через туннель / блокировка рекламы) — временно **системный** или исключение для вашего домена.
3. На панели Smart DNS реально слушает **:53** снаружи (см. разделы про bind и фаервол).
4. Для изоляции: в тесте задайте в хосте Marzban **прямой IP** одной ноды вместо FQDN — если TUN сразу оживает, причина именно в **DNS‑пути в TUN**, а не в сертификате Hysteria.

Связь с метриками: пока клиент не стабильно ходит на ноду, в `trafficStats` может не появляться ожидаемый трафик; но **0 conn / 0 bw** в дашборде чаще из‑за отдельной проблемы **`trafficStats` + secret** (см. п.6 и раздел ниже).

### 7b. Почему в Smart DNS **0 подключений** и **0 Mbps** (и связь с `unauthorized`)

Панель показывает **не «сколько юзеров в Marzban»**, а данные из **`GET /metrics` ноды**. Поля **`active_connections`** и **`bandwidth_mbps`** заполняются только если нода опрашивает HTTP **Traffic Stats API** Hysteria (`GET /traffic`).

Условия:

1. В **`hysteria.yaml`** на сервере Hysteria есть **`trafficStats.listen`** и **`trafficStats.secret`** (см. [Traffic Stats API — Hysteria 2](https://v2.hysteria.network/docs/advanced/Traffic-Stats-API/)).
2. Запрос с **тем же** значением в заголовке: `Authorization: <secret>` (без префикса `Bearer`, если не указано иное в вашей версии).
3. Проверка с хоста, где крутится Hysteria (у вас часто панель: `127.0.0.1:9999`):
   ```bash
   curl -sS -H "Authorization: СЕКРЕТ_ИЗ_hysteria.yaml" http://127.0.0.1:9999/traffic
   ```
   Ответ **`unauthorized`** = в `curl` не тот секрет, что в **текущем** конфиге процесса Hysteria (или не перезапустили контейнер после смены YAML).
4. На **Marzban-node** в `.env`: **`HYSTERIA2_TRAFFIC_SECRET`** = тот же `secret`; **`HYSTERIA2_TRAFFIC_LISTEN`** = адрес:порт, с которого **процесс ноды** достучится до API (при `network_mode: host` часто `127.0.0.1:9999`; при раздельных контейнерах — IP сервиса Hysteria в docker‑сети, не «чужой» localhost).
5. На панели в `.env`: **`HYSTERIA2_TRAFFIC_SECRET`** тот же (для кеша/документации; сами нули на дашборде чинятся настройкой ноды и `trafficStats`).

Пока п.3 не даёт JSON (хотя бы `{}`), дашборд Smart DNS будет показывать **нули**, даже если клиенты реально качают трафик по Hysteria.

### 8. Проверка в GUI

В дашборде: меню → **Smart DNS** — пулы, метрики, UP/DOWN (работает только при **`SMART_DNS_ENABLED=True`**).

### Docker (кратко)

В `docker-compose` (или аналоге) для сервиса панели:

```yaml
cap_add:
  - NET_BIND_SERVICE
ports:
  - "53:53/udp"
  - "53:53/tcp"
```

Один контейнер/процесс с Marzban — **не** несколько воркеров с общим :53.

---

## Requirements

- **Single Marzban process** with Smart DNS enabled (do not run multiple Uvicorn workers; DNS and the poller use background threads).
- **Linux (or similar)**: binding to **UDP/TCP port 53** usually requires `CAP_NET_BIND_SERVICE` or root.
- **Marzban-node** (REST) exposes **`GET /metrics`** over the same mTLS port as the control API (`Node.port`, default `62050`).
- Nodes in a pool share the same **`smart_dns_name`** (FQDN). Optional **`smart_dns_announce_ip`** is the IPv4 returned to clients if it differs from the panel-to-node management address.

## Registrar / DNS delegation

1. Choose a hostname per region, e.g. `eu.vpn.example.com`.
2. At your DNS provider, create an **NS delegation** for that hostname (or a parent zone) pointing to the **Marzban host’s public IP** as the authoritative nameserver, **or** delegate to hostnames that resolve to that IP (glue records).
3. Set **`SMART_DNS_SOA_MNAME`** to a nameserver name you advertise (e.g. `ns1.eu.vpn.example.com.`) and ensure that name resolves to the panel IP.

## Panel configuration (`.env`)

| Variable | Description |
|----------|-------------|
| `SMART_DNS_ENABLED` | `true` to start the metrics poller and DNS servers. |
| `SMART_DNS_BIND_HOST` | Bind address (default `0.0.0.0`). |
| `SMART_DNS_PORT` | DNS port (default `53`). |
| `SMART_DNS_DEFAULT_TTL` | A/NS/SOA TTL in seconds (e.g. `10`). |
| `SMART_DNS_METRICS_INTERVAL` | Seconds between `GET /metrics` polls (e.g. `3`). |
| `SMART_DNS_METRICS_TIMEOUT` | Per-request timeout seconds. |
| `SMART_DNS_FAIL_THRESHOLD` | Consecutive failures before a node is excluded from answers. |
| `SMART_DNS_SCORE_BW_MULT` | Weight for `bandwidth_mbps` in score (default `0.7`). |
| `SMART_DNS_SCORE_CPU_MULT` | Weight for `cpu` in score (default `0.5`). |
| `SMART_DNS_RATE_LIMIT_QPS` | Max sustained DNS queries per second **per source IP** (`0` = disabled). |
| `SMART_DNS_SOA_MNAME` | Primary NS host for SOA (FQDN with trailing dot recommended). |
| `SMART_DNS_SOA_RNAME` | Hostmaster mailbox as FQDN (e.g. `hostmaster.example.com.`). |
| `SMART_DNS_SOA_SERIAL` | SOA serial (bump when you change zone semantics). |
| `SMART_DNS_ALERT_MAX_SCORE` | If `> 0`, dashboard alerts when node score ≥ this value. |
| `SMART_DNS_ALERT_MAX_CPU` | If `> 0`, alerts when reported CPU ≥ this. |
| `SMART_DNS_ALERT_MAX_BANDWIDTH_MBPS` | If `> 0`, alerts when reported Mbps ≥ this. |

## Docker

Grant bind permission on port 53, for example:

```yaml
cap_add:
  - NET_BIND_SERVICE
ports:
  - "53:53/udp"
  - "53:53/tcp"
```

## Node (Marzban-node)

- **`NODE_METRICS_INTERVAL`**: seconds between local metric samples (default `3`).
- Hysteria2: configure `trafficStats` with a reachable listen and the same secret as the panel’s `HYSTERIA2_TRAFFIC_SECRET` when using traffic-based metrics.
- **`HYSTERIA2_TRAFFIC_LISTEN`**: use `0.0.0.0:PORT`, or **`[::]:PORT`** for dual-stack bind (the node maps these to `127.0.0.1` for local HTTP). For a **specific IPv6** use **`[2001:db8::1]:PORT`** so the URL is formed correctly.
- Panel **node `address`**: if you store an IPv6 literal, you may use **`2001:db8::1`** or **`[2001:db8::1]`**; the Smart DNS poller normalizes it to **`https://[...]:port/metrics`**.
- **`/metrics`** is protected by the **same mTLS** as the REST control API (panel client certificate).

## TLS / SNI

Clients resolve the pool name to a **node IP** but often still present the **regional domain** as SNI. Use a certificate on each node that is valid for that name (e.g. a shared wildcard).

## Limitations

- **`active_connections`** on the node is derived from Hysteria traffic-map size when traffic stats are used; it is a proxy, not a raw TCP connection count.
- Smart DNS v1 is designed for a **single** Marzban worker process.
- Answers are **IPv4 `A` records only**. Put a valid IPv4 in **`smart_dns_announce_ip`** (or use the node `address` if it is already IPv4). **IPv6-only** client-facing addresses are not supported until `AAAA` is added.
- After HTTP failures, a node can still be treated as UP until **`SMART_DNS_FAIL_THRESHOLD`** consecutive failures; this reduces flapping but delays full exclusion by up to `(threshold − 1) × SMART_DNS_METRICS_INTERVAL` seconds.
- With **`SMART_DNS_ENABLED=false`**, the metrics poller does not run: the Smart DNS dashboard stays empty even if nodes have `smart_dns_name` set.

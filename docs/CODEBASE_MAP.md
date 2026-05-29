# Marzban Fork — Codebase Map

> Foundation document for the **v0.9.0 stability release**.
> Current version: **0.8.4** (`app/__init__.py:13`).
> Status: READ-ONLY survey. No code was modified to produce this.

---

## 1. Architecture Overview

### Components

```
                                  ┌──────────────────────────────────────────────┐
                                  │                main.py (uvicorn)              │
                                  │   workers=1 (APScheduler+Xray need singleton) │
                                  └───────────────────────┬──────────────────────┘
                                                          │
                       ┌──────────────────────────────────┴───────────────────────────────────┐
                       │                       FastAPI app  (app/__init__.py)                   │
                       │   CORS · RequestValidation handler · startup/shutdown hooks            │
                       └───┬───────────────┬───────────────┬───────────────┬───────────────┬───┘
                           │               │               │               │               │
                  ┌────────▼──────┐ ┌──────▼───────┐ ┌─────▼────────┐ ┌────▼─────────┐ ┌───▼──────────┐
                  │  API routers  │ │ Subscription │ │  Dashboard   │ │ Telegram bot │ │  APScheduler │
                  │ app/routers/  │ │  router +    │ │ (static SPA) │ │ (daemon      │ │  jobs        │
                  │ admin/user/   │ │ app/sub/     │ │ app/dashboard│ │  thread,     │ │  app/jobs/   │
                  │ node/core/... │ │ share.py     │ │ /build       │ │  polling)    │ │              │
                  └───────┬───────┘ └──────┬───────┘ └──────────────┘ └──────┬───────┘ └──────┬───────┘
                          │                │                                 │                │
                          └────────────────┴───────────────┬─────────────────┴────────────────┘
                                                            │
                              ┌─────────────────────────────┼──────────────────────────────┐
                              │                             │                              │
                     ┌────────▼─────────┐         ┌─────────▼──────────┐          ┌────────▼─────────┐
                     │  DB layer        │         │  Xray subsystem     │          │  utils/report    │
                     │  app/db/         │         │  app/xray/          │          │  notifications,  │
                     │  crud.py (57 fns)│◄───────►│  config·core·node·  │          │  webhook, TG,    │
                     │  models.py       │         │  operations         │          │  discord         │
                     │  SQLAlchemy 2.0  │         └──────┬───────┬───────┘          └──────────────────┘
                     └──────────────────┘                │       │
                                                          │       │
                                       local core ────────┘       └──────── remote nodes
                                  ┌───────────────────┐      ┌────────────────────────────────────┐
                                  │ xray run -config  │      │ XRayNode  (factory):               │
                                  │ stdin:  (subproc) │      │  • ReSTXRayNode  (HTTPS + mTLS)     │
                                  │ + gRPC API inbound│      │  • RPyCXRayNode  (rpyc + mTLS)      │
                                  │ (dokodemo-door)   │      │ each + gRPC Xray API @ api_port     │
                                  └───────────────────┘      └────────────────────────────────────┘
```

### Request flow (authenticated API call)

`HTTP request` → uvicorn → FastAPI middleware (CORS) → router endpoint (`app/routers/*.py`,
mostly **sync `def`** so FastAPI runs them in a threadpool) → `Depends(Admin.get_current)` auth
(`app/models/admin.py`, JWT via `app/utils/jwt.py`) → `Depends(get_db)` yields a `SessionLocal`
(`app/db/__init__.py:21-23`) → `crud.*` functions (`app/db/crud.py`) execute SQLAlchemy against
the DB → for state-changing user/node ops the router schedules a FastAPI `BackgroundTask` calling
`xray.operations.*` to sync the running Xray cores → Pydantic response model serializes → JSON out.

### Request flow (subscription)

`GET /{XRAY_SUBSCRIPTION_PATH}/{token}` → `app/routers/subscription.py:48` →
`Depends(get_validated_sub)` (`app/dependencies.py:67-82`) decodes the token
(`app/utils/jwt.py:60-90`) and loads the user → User-Agent regex picks the output format
(`subscription.py:81-139`) → `app/subscription/share.py:generate_subscription` dispatches to a
per-format builder (v2ray / v2ray-json / clash / clash-meta / sing-box / outline) →
`process_inbounds_and_tags` (`share.py:232-323`) merges `xray.config.inbounds_by_tag` with
`xray.hosts` per user → rendered (optionally base64) → response with sub headers.

### Background jobs (APScheduler, all `coalesce=True, max_instances=1`)

Jobs are auto-discovered by globbing `app/jobs/*.py` (skipping `_`-prefixed) in `app/jobs/__init__.py:5-13`.
The scheduler is a single `BackgroundScheduler` (`app/__init__.py:23-25`, UTC, started in the
`startup` event). **Single uvicorn worker is mandatory** because the scheduler and Xray state are
in-process singletons (`main.py:48-49,99`).

| Job | Function | Interval (default) | Defined in | Config key |
|-----|----------|--------------------|------------|------------|
| Core/node health check | `core_health_check` | **10 s** | `app/jobs/0_xray_core.py:11-65` | `JOB_CORE_HEALTH_CHECK_INTERVAL` |
| Record user usage | `record_user_usages` | **10 s** | `app/jobs/record_usages.py:130-222` | `JOB_RECORD_USER_USAGES_INTERVAL` |
| Record node/system usage | `record_node_usages` | **30 s** | `app/jobs/record_usages.py:186-225` | `JOB_RECORD_NODE_USAGES_INTERVAL` |
| Review users (status machine) | `review` | **10 s** | `app/jobs/review_users.py:54-120` | `JOB_REVIEW_USERS_INTERVAL` |
| Reset data usage (day/week/month/year) | `reset_user_data_usage` | **hourly** | `app/jobs/reset_user_data_usage.py:15-43` | — |
| Auto-delete expired users | `remove_expired_users` | **6 h** | `app/jobs/remove_expired_users.py:12-23` | `USERS_AUTODELETE_DAYS` (gate) |
| Send webhook notifications | `send_notifications` | **30 s** (only if `WEBHOOK_ADDRESS`) | `app/jobs/send_notifications.py:54-97` | `JOB_SEND_NOTIFICATIONS_INTERVAL` |
| Delete expired reminders | `delete_expired_reminders` | **2 h** (only if `WEBHOOK_ADDRESS`) | `app/jobs/send_notifications.py:82-98` | — |

Plus startup/shutdown lifecycle hooks in `0_xray_core.py:37-78` (start main core, connect nodes;
stop core, disconnect nodes). The `0_` filename prefix forces it to import first.

### Node communication — gRPC **and** REST/rpyc (two channels)

There are **two transports per node**:

1. **Control channel** — auto-detected per connection by `XRayNode.__new__`
   (`app/xray/node.py:496-531`): it opens a TCP socket and sends `HEAD / HTTP/1.0`; an HTTP-like
   reply ⇒ **`ReSTXRayNode`** (HTTPS + mutual TLS, `requests.Session`), otherwise ⇒
   **`RPyCXRayNode`** (rpyc over SSL). Used for `/connect`, `/start`, `/stop`, `/restart`, logs.
2. **Data/stats channel** — **always gRPC over TLS** to the node's Xray API port (`api_port`,
   default 62051), via `XRayAPI` (`xray_api/base.py:4-19`, `secure_channel` with SSL target-name
   override `"Gozargah"`). Used to add/remove inbound users and pull traffic stats.

The local core uses the same gRPC `XRayAPI` against an injected `dokodemo-door` `API_INBOUND`
listening on a randomly chosen free localhost port (`app/xray/__init__.py:18-27`,
`app/xray/config.py:64-125`). Node ports configured per-node row: `port` (control) + `api_port`
(gRPC) in `app/db/models.py:300-301`.

---

## 2. Module Breakdown (`app/`)

### `app/routers/` — HTTP API surface
- **Purpose:** FastAPI endpoint definitions; thin controllers delegating to `crud` + `xray.operations`.
- Key files:
  - `admin.py` — admin CRUD, login/token, sudo management.
  - `user.py` — user CRUD, reset, set-owner, sub-revoke, bulk/usage endpoints (largest, 14.6 KB).
  - `node.py` — node add/modify/delete/reconnect, node logs (websocket), node usage.
  - `subscription.py` — public subscription endpoints (token-based, no admin auth).
  - `core.py` — core stats, restart, get/put live Xray config, core logs (websocket).
  - `system.py` — system stats, inbounds, host management.
  - `user_template.py` — user template CRUD.
  - `home.py` — serves the home HTML page.
  - `__init__.py` — aggregates all routers into `api_router`.
- **Dependencies:** `app/db` (crud), `app/xray` (operations/config), `app/models`, `app/dependencies.py`.
- **Patterns:** Dependency-injection auth (`Depends(Admin.get_current)` / `check_sudo_admin`);
  endpoints are **sync `def`** (threadpool) except the two websocket handlers; `route.name` reused
  as `operation_id` (`app/__init__.py:41-47`); side effects deferred via `BackgroundTasks`.

### `app/db/` — persistence
- **Purpose:** SQLAlchemy ORM models, session factory, and all CRUD logic.
- Key files:
  - `base.py` — engine + `SessionLocal`; SQLite vs pooled-MySQL branching (`base.py:9-25`).
  - `__init__.py` — `GetDB` context manager + `get_db` dependency; re-exports crud functions.
  - `models.py` — 15 ORM tables (see §4).
  - `crud.py` — 57 functions; the de-facto data-access layer (45 KB).
  - `migrations/` — Alembic env + 62 version files.
- **Dependencies:** `config.py`, `app.models.*` (enums), and **imports `app.xray`** in `models.py:23`
  (the `User.inbounds` hybrid reads `xray.config.inbounds_by_protocol`) — a notable layering coupling.
- **Patterns:** Context-manager sessions; hybrid properties (`User.reseted_usage`,
  `models.py:105-115`); raw `update().values(...bindparam...)` bulk writes in jobs.

### `app/models/` — Pydantic schemas (API contracts)
- **Purpose:** request/response validation + domain enums (distinct from DB models).
- Key files:
  - `user.py` — `UserStatus` enum, `User`/`UserCreate`/`UserModify`/`UserResponse`/`SubscriptionUserResponse`, validators.
  - `proxy.py` — `ProxyTypes`, per-protocol settings models, `ProxyHost*` enums, fragment/noise regex validators.
  - `node.py` — `NodeStatus` enum + node schemas.
  - `admin.py` — admin schemas, password hashing/verification, JWT `get_current`.
  - `core.py`, `system.py`, `user_template.py` — smaller schema sets.
- **Dependencies:** `xray_api.types.account` (proxy.py), `app.subscription.share`, `app.utils.jwt`,
  and **`app.xray`** (user.py validators reference `xray.config`).
- **Patterns:** **Pydantic v2** (`ConfigDict`, `field_validator`, `model_validator`); restricted
  status sub-enums (`UserStatusCreate`/`UserStatusModify`) to limit client-settable states.

### `app/xray/` — Xray orchestration
- **Purpose:** build Xray JSON, run the local core, connect/manage remote nodes, mutate users at runtime.
- Key files:
  - `config.py` — `XRayConfig` (dict subclass); parse base config, resolve inbounds, inject API, bake users (`include_db_users`).
  - `core.py` — `XRayCore`: subprocess lifecycle (`xray run -config stdin:`), log ring buffer, `x25519`/version helpers.
  - `node.py` — `XRayNode` factory + `ReSTXRayNode`/`RPyCXRayNode`.
  - `operations.py` — `add_user/remove_user/update_user`, `connect_node/restart_node/add_node/remove_node`, node status transitions.
  - `__init__.py` — module singletons: `core`, `config`, `api`, `nodes`, `hosts`, `operations`.
- **Dependencies:** `xray_api/` (gRPC client), `app.db` (lazy, inside functions), `app.utils.store/system/crypto`.
- **Patterns:** Module-level singletons created at import; `@threaded_function` fire-and-forget for
  node/user ops; `@DictStorage` lazy in-memory cache for hosts; config delivered to core via **stdin**.

### `app/subscription/` — client config generation
- **Purpose:** turn a user + their inbounds/hosts into client subscription configs.
- Key files:
  - `share.py` — orchestrator: `generate_subscription`, `process_inbounds_and_tags`, format-variable setup.
  - `v2ray.py` — `V2rayShareLink` (vmess/vless/trojan/ss URIs) + `V2rayJsonConfig` (full Xray outbound JSON) (37 KB).
  - `clash.py` — `ClashConfiguration` / `ClashMetaConfiguration`.
  - `singbox.py` — `SingBoxConfiguration`.
  - `outline.py` — `OutlineConfiguration` (shadowsocks only).
  - `funcs.py`, `__init__.py` — helpers + class registry.
- **Dependencies:** `app.xray` (config + hosts), `app.templates/*`, `config.py` (template paths, custom-JSON flags).
- **Patterns:** Strategy/registry per format; Jinja-ish template files under `app/templates/`;
  builder `.add()` / `.render()` interface. **No per-client transport filtering** (see §3b).

### `app/telegram/` — Telegram bot
- **Purpose:** admin/user management + event reporting via Telegram.
- Key files: `__init__.py` (bot init + handler loading + `infinity_polling` in a daemon thread,
  `:27-28`); `handlers/admin.py` (very large, 2000+ lines), `handlers/user.py`, `handlers/report.py`;
  `utils/` (keyboards, custom filters, shared helpers).
- **Dependencies:** `pyTelegramBotAPI` (`telebot`), `app.db`, `app.xray`, `config.py`.
- **Patterns:** Dynamic handler module loading via `importlib`; runs in a background thread separate from uvicorn.

### `app/discord/` — Discord webhook reporting
- **Purpose:** mirror report events to a Discord webhook. `handlers/report.py` + `__init__.py`.
- **Dependencies:** `requests`, `config.DISCORD_WEBHOOK_URL`.

### `app/jobs/` — scheduled tasks
- See §1 job table. Each module registers itself with the shared `scheduler` on import.

### `app/utils/` — cross-cutting helpers
- `jwt.py` (access + subscription tokens), `report.py` (fan-out to TG/Discord/webhook),
  `notification.py` (webhook queue), `system.py` (port checks, memory/cpu, random_password),
  `crypto.py` (cert SANs, key parsing), `store.py` (`DictStorage` decorator),
  `concurrency.py` (`@threaded_function`), `helpers.py`, `responses.py`.

### `app/templates/` — output templates
- Jinja/JSON/YAML templates for `clash/`, `singbox/`, `v2ray/`, `mux/`, `subscription/` (HTML),
  `home/` (HTML), and `user_agent/` (fake UA pools for `random_user_agent`).

### `app/dashboard/` — frontend SPA
- React 18 + TypeScript + Vite + Chakra UI; prebuilt static output in `build/` (see §4).

### Top-level (not under `app/`)
- `main.py` (uvicorn bootstrap + SSL validation), `config.py` (all env settings via `python-decouple`),
  `xray_api/` (vendored gRPC Xray API client + compiled protobufs), `cli/` + `marzban-cli.py`
  (Typer CLI: admin/user/subscription), `xray_config.json` (default base Xray config), `alembic.ini`.

---

## 3. Critical Code Paths

### 3a. Node lifecycle

**Add** — `POST /api/node` → `add_node` (`app/routers/node.py:50-70`, sudo-only) →
`crud.create_node` (`app/db/crud.py:1296-1315`) inserts a `Node` row (default status `connecting`,
`app/db/models.py:303`). Two background tasks scheduled: `xray.operations.connect_node` and
`add_host_if_needed` (`node.py:66-67`). Duplicate name (unique `NOCASE`) → 409 (`node.py:60-64`).
⚠️ `usage_coefficient` from the create payload is **not persisted at creation** — only via
`update_node` (`crud.py:1307-1311` vs `1365-1366`).

**Connect** — `connect_node` (`app/xray/operations.py:195-236`, `@threaded_function`): guards via
`_connecting_nodes` dict; `add_node` (`operations.py:161-172`) builds the `XRayNode` with the panel
TLS cert (`get_tls()`, cached); sets status `connecting`; generates config via
`xray.config.include_db_users()` if none passed; `node.start(config)`; records version; sets
`connected`. Node `start` inlines cert/key files into the config (`_prepare_config`,
`node.py:80-100` / `384-404`) then opens the gRPC `XRayAPI` and waits ≤5 s for the channel.

**Monitor** — `core_health_check` every 10 s (`app/jobs/0_xray_core.py:11-34`): restarts dead local
core; for each node probes `node.api.get_sys_stats(timeout=2)` (gRPC) and `node.connected` (control
`/ping` or rpyc ping); on `ConnectionError`/`XrayError`/`AssertionError` → `restart_node`; if still
disconnected → `connect_node`. The lightweight `connected` property: `node.py:117-125` (REST),
`node.py:356-363` (rpyc).

**Disconnect** — shutdown hook disconnects all nodes (`0_xray_core.py:68-78`, swallows errors);
`remove_node` (`operations.py:148-158`) disconnects + deletes the in-memory object.

**Retry logic** — three distinct mechanisms, **none with exponential backoff**:
1. rpyc connect retry ≤3 attempts on `EOFError`, **no sleep / spins immediately** (`node.py:351-354`).
2. The 10 s health-check cadence *is* the reconnect loop (fixed interval, indefinite).
3. DB deadlock retry ≤3 in `safe_execute` for MySQL error 1213 (`record_usages.py:36-41`).

**Error handling** — mostly **swallowed + logged at INFO + persisted to `Node.message`**:
`connect_node`/`restart_node` wrap everything in `except Exception`, set status `error` with
`message=str(e)`, log at **info** without the exception text in the log line
(`operations.py:228-230`, `263-269`). Connection failures are **never surfaced synchronously** to
the API caller — admin must poll node `status`/`message`.

**States** — `NodeStatus` enum `connected | connecting | error | disabled`
(`app/models/node.py:7-11`; DB column `models.py:303`). Transitions via
`crud.update_node_status` (`crud.py:1373-1390`, stamps `last_status_change`) wrapped by
`_change_node_status` (`operations.py:175-188`, refuses to overwrite `disabled`).

**Usage collection** — `record_user_usages` (10 s) and `record_node_usages` (30 s) in
`record_usages.py`; only nodes where `node.connected and node.started` are polled
(`record_usages.py:134-137,188-190`); stats pulled with **`reset=True`** (read-and-clear deltas)
via gRPC, multiplied by per-node `usage_coefficient`, written to `User.used_traffic`/`online_at`,
`Admin.users_usage`, and hourly `NodeUserUsage`/`NodeUsage` rows.

### 3b. Subscription generation

**Endpoints** (`app/routers/subscription.py`, prefix `/{XRAY_SUBSCRIPTION_PATH}`):
`GET /{token}` & `/{token}/` (auto-format), `/{token}/info`, `/{token}/usage`,
`/{token}/{client_type}` (explicit; regex `sing-box|clash-meta|clash|outline|v2ray|v2ray-json`).
All resolve the user via `Depends(get_validated_sub)`.

**Token → user** (`app/utils/jwt.py:60-90`): two schemes. Legacy HS256 JWT (token starts with the
fixed base64 header) requiring `access == "subscription"`; and the default custom token
`base64url(username,unix_ts) + 10-char sha256(token+secret)` signature. `get_validated_sub`
(`app/dependencies.py:67-82`) rejects if user missing, `created_at > sub.created_at`, or
`sub_revoked_at > sub.created_at` (revocation).

**Format selection** — **User-Agent regex** (`subscription.py:81-139`), not a query param:
Clash-verge/Meta/mihomo→clash-meta; Clash/Stash→clash; SFA/SFI/Karing/HiddifyNext→sing-box;
SS/Outline/Shadowsocks→outline; v2rayN/v2rayNG/Streisand/Happ→v2ray-json or v2ray (version-gated +
`USE_CUSTOM_JSON_*` flags); fallback→v2ray base64. (The `app/templates/user_agent/` files are
unrelated — fake UA pools for `random_user_agent` host headers.)

**Per-format builders** — dispatched by `generate_subscription` (`app/subscription/share.py:100-131`):
- v2ray links → `V2rayShareLink` (`v2ray.py:25-485`)
- v2ray-json → `V2rayJsonConfig` (`v2ray.py:488-1082`)
- clash/clash-meta → `ClashConfiguration`/`ClashMetaConfiguration` (`clash.py`)
- sing-box → `SingBoxConfiguration` (`singbox.py:18`)
- outline → `OutlineConfiguration` (`outline.py:4`)
Result base64-encoded if `as_base64` (`share.py:128-129`).

**Per-client assembly** — `process_inbounds_and_tags` (`share.py:232-323`): flattens
`user.inbounds` → `(protocol,[tag])`, sorts by global inbound order, and for each
`host in xray.hosts.get(tag, [])` merges host overrides onto a copy of
`xray.config.inbounds_by_tag[tag]` (random SNI/host/address from comma-lists, TLS =
`inbound["tls"] if host["tls"] is None else host["tls"]`, port fallback), then
`conf.add(remark, address, inbound=host_inbound, settings=...)`. One entry per
**(user-proxy-protocol × inbound-tag × host)**.

**Transport filtering — IMPORTANT:** there is **NO per-client / per-user transport (tcp/ws/grpc)
filtering** anywhere in the subscription path. User granularity is **per-inbound-tag** only
(via `Proxy.excluded_inbounds`). The only transport-based dropping is **per-format capability
gating** (identical for all users): clash drops kcp/splithttp/xhttp (`clash.py:256-259`); clash-meta
& sing-box additionally drop quic-with-header (`clash.py:347-350`, `singbox.py:291-293`); outline
keeps only shadowsocks (`outline.py:30-33`); v2ray drops nothing. To add per-client transport
restriction it would go in `process_inbounds_and_tags` by filtering `inbound["network"]`.

**Host resolution** — `xray.hosts` (`app/xray/__init__.py:36-67`) is a `@DictStorage` cache keyed by
inbound tag, populated from non-disabled `ProxyHost` rows (`crud.get_hosts`), with comma-lists split
and `tls=None` meaning "inherit inbound default". Refreshed via `xray.hosts.update()` after host edits.

### 3c. User state machine

**States** — `UserStatus`: `active | disabled | limited | expired | on_hold`
(`app/models/user.py:24-29`; DB column `models.py:67`, default `active`). Client-settable subsets:
`UserStatusCreate` (active, on_hold) and `UserStatusModify` (active, disabled, on_hold) — the system
sets `limited`/`expired` itself. `on_hold` = pre-activation: user is in Xray but the clock hasn't
started; carries `on_hold_expire_duration` (seconds) + `on_hold_timeout` (deadline)
(`models.py:87-88`). Both `active` and `on_hold` users are baked into Xray
(`config.py:377` filters `status.in_([active, on_hold])`).

**Transitions** (driven by `review()` every 10 s, `app/jobs/review_users.py:54-120`):
- `active → limited` when `used_traffic >= data_limit` (`review_users.py:60,74`) → `remove_user` + `update_user_status`.
- `active → expired` when `expire <= now` (`review_users.py:61,76`) → `remove_user` + `update_user_status`.
- `on_hold → active` when the user connected (`online_at >= base_time`) or `on_hold_timeout` passed
  (`review_users.py:99-104`) → `update_user_status` + `start_user_expire` (sets
  `expire = now + on_hold_expire_duration`, clears on_hold fields, `crud.py:845-862`).
- `any → disabled` via `PUT /api/user/{username}` (`app/routers/user.py:79-122`); router then
  `add_user`/`update_user` if active/on_hold else `remove_user` (`user.py:115-118`).
- `limited → active` on data reset: scheduled (`reset_user_data_usage.py:37-38`), manual
  `POST /user/{username}/reset`, or `data_limit` raised above usage (`crud.py:474-489`) → `add_user`.
- `expired → active` when `expire` pushed into the future via modify (`crud.py:491-504`).
- limited/expired with a `next_plan` → rolled over to `active` via `reset_user_by_next`
  (`crud.py:567-602`, `review_users.py:63-72`).

**Xray ↔ DB sync** — `app/xray/operations.py`: user email = `f"{id}.{username}"`. `add_user`
(`:59-91`), `remove_user` (`:93-100`), `update_user` (`:103-145`) apply to the local core and every
connected+started node via the gRPC HandlerService, swallowing `EmailExists/EmailNotFound/Connection`
errors. On node (re)connect the node is bootstrapped with the full active+on_hold set via
`include_db_users()`.

**Usage tracking** — `record_user_usages` (10 s) accumulates `User.used_traffic` and bumps
`online_at` (the field `review` uses for on_hold activation); the actual `used_traffic >= data_limit`
comparison is in `review()`, not the recorder.

**Reset strategy** — `UserDataLimitResetStrategy` (`no_reset|day|week|month|year`,
`user.py:43-48`). `reset_user_data_usage` (hourly) compares `last_traffic_reset_time` against
day=1/week=7/month=30/year=365 (`reset_user_data_usage.py:7-12`), then `crud.reset_user_data_usage`
(`crud.py:535-564`) snapshots usage to `UserUsageResetLogs`, zeroes `used_traffic`/`node_usages`,
and re-activates non-expired/disabled users.

### 3d. Xray config generation

**`XRayConfig`** (`app/xray/config.py:29`) subclasses `dict`; the instance *is* the config.
Constructor accepts dict / JSON-string / file path; parsed with **`commentjson`** (comments allowed)
(`config.py:34-48`). Runs `_validate` → builds inbound index → caches fallback inbound →
`_resolve_inbounds` → `_apply_api`.

**`_apply_api`** (`config.py:64-125`) injects a `dokodemo-door` `API_INBOUND` on `api_host:api_port`
(position 0), an `api` block (Handler/Stats/Logger services, tag `API`), `stats`, a `policy` forcing
per-user up/down stats, and a routing rule `API_INBOUND → API`.

**`_resolve_inbounds`** (`config.py:143-343`) normalizes every supported inbound into a metadata dict
(`tag, protocol, port, network, tls, sni, host, path, header_type, is_fallback`), parsing
stream/security settings per transport (tcp/raw, ws, grpc, quic, httpupgrade, splithttp/xhttp, kcp,
http/h2/h3) and TLS/Reality (deriving Reality `pbk` from `privateKey` via `core.get_x25519`). Skips
non-`ProxyTypes` protocols and `XRAY_EXCLUDE_INBOUND_TAGS`. Populates `inbounds`,
`inbounds_by_tag`, `inbounds_by_protocol`.

**`include_db_users`** (`config.py:361-436`) deep-copies the config, runs one grouped query for
active+on_hold users (`config.py:365-384`), and appends `{"email": "id.username", **proxy_settings}`
to each matching inbound's `settings.clients`, honoring per-user excluded inbounds and **stripping
`flow`** when XTLS can't apply (network ∉ tcp/raw/kcp, or tls ∉ tls/reality, or header_type==http,
`config.py:417-428`).

**Push to core** — `XRayCore.start/restart` (`core.py:106-160`) launches `xray run -config stdin:`
and **writes the config JSON to the subprocess stdin** (never a file); a thread captures logs into a
100-line ring buffer. **Push to nodes** — `node.start(config)` after `_prepare_config` inlines
cert/key files (`node.py:80-100`/`384-404`), then `/start` (REST) or `remote.start` (rpyc).

**Singletons at import** (`app/xray/__init__.py`): `core`, `config` (loaded from `XRAY_JSON`,
default `./xray_config.json`, with API inbound on a scanned free port), `api` (local gRPC client),
`nodes={}`, lazy `hosts`.

**Runtime mutations** don't regenerate the whole config — `operations.add_user/remove_user` build
per-protocol `Account` objects (`xray_api/types/account.py`) and call the gRPC HandlerService.
Note: `TrojanAccount.message` does **not** serialize `flow` into the protobuf (`account.py:57-59`).

**Default base config** (`xray_config.json`): one inbound `"Shadowsocks TCP"` (port 1080,
tcp,udp), `freedom`(DIRECT) + `blackhole`(BLOCK) outbounds, a geoip:private→BLOCK rule, loglevel warning.

---

## 4. Tech Stack Inventory

### Runtime
- **Python 3.12** (`Dockerfile:1` `ARG PYTHON_VERSION=3.12`). No `pyproject.toml` / `setup.py` — deps in `requirements.txt`.
- **No upper-bound version constraints in code beyond pinned exacts** in `requirements.txt`.

### Key Python dependencies (`requirements.txt`)
| Package | Version | Notes |
|---------|---------|-------|
| **fastapi** | **0.115.2** | current major; OK |
| **starlette** | 0.40.0 | matches fastapi |
| **pydantic** | **2.10.4** | **v2** ✅ (already migrated; uses `field_validator`/`ConfigDict`) |
| **SQLAlchemy** | **2.0.36** | **2.0** ✅ current |
| **alembic** | 1.14.0 | current |
| **uvicorn** | 0.27.0.post1 | slightly behind latest |
| **APScheduler** | 3.9.1.post1 | 3.x (4.x is async-native; not used) |
| pyTelegramBotAPI | 4.9.0 | see below |
| grpcio / grpcio-tools | 1.67.1 | node API + stats |
| rpyc | 6.0.0 | legacy node control channel |
| PyJWT | 2.8.0 | tokens |
| bcrypt / passlib | 4.0.1 / 1.7.4 | password hashing |
| cryptography / pyOpenSSL | 43.0.1 / 24.2.1 | TLS, cert SAN parsing |
| PyMySQL | 1.1.1 | MySQL driver (no async driver) |
| Jinja2 | 3.1.4 | templates |
| commentjson | 0.9.0 | parse Xray config with comments |
| requests | 2.32.3 | sync HTTP (node REST, webhooks, discord) |
| qrcode, jdatetime, psutil, click, typer(0.7.0), rich | — | misc |

**Outdated-major flags:** none of FastAPI/SQLAlchemy/Pydantic are on an old major — Pydantic is
already **v2** and SQLAlchemy is **2.0**. The notable laggard is **`typer==0.7.0`** (quite old) and
**APScheduler 3.x** (a deliberate choice; the codebase is sync-job oriented).

### Frontend (`app/dashboard/package.json`)
- **React 18.2**, **TypeScript 4.9.5**, **Vite 3.1** (bundler), **Chakra UI 2.5** (component lib),
  Emotion, Framer Motion 7, react-query 3, zustand 4, react-router-dom 6, react-hook-form 7 + zod,
  i18next, apexcharts, react-use-websocket. Build output is committed under `app/dashboard/build/`
  (`index.html`, `404.html`, `statics/`); built via `build_dashboard.sh` (`tsc && vite build`).
  TypeScript 4.9 and Vite 3 are both a few majors behind current.

### Database
- Engine: SQLite by default (`sqlite:///db.sqlite3`), MySQL via PyMySQL supported
  (`config.py:7`, `app/db/base.py:9-23`). Connection pooling only for non-SQLite
  (pool_size 10 / max_overflow 30 / recycle 3600 / timeout 10).
- **Alembic migrations: 62** version files (`app/db/migrations/versions/`). `alembic upgrade head`
  runs on container start (`Dockerfile:35`). Several `merge`/`fix` revisions present (history has
  had multiple heads merged).
- **Tables (15)** — from `app/db/models.py`:

  | Table | Model | Primary purpose |
  |-------|-------|-----------------|
  | `admins` | Admin | panel admins (sudo flag, tg/discord, usage) |
  | `admin_usage_logs` | AdminUsageLogs | admin traffic reset snapshots |
  | `users` | User | core subscriber records (status, limits, expire, on_hold, sub fields) |
  | `next_plans` | NextPlan | queued plan to roll over on limit/expiry |
  | `user_templates` | UserTemplate | reusable user creation presets |
  | `user_usage_logs` | UserUsageResetLogs | per-user usage reset snapshots |
  | `proxies` | Proxy | per-user per-protocol credentials (JSON settings) |
  | `inbounds` | ProxyInbound | known inbound tags |
  | `hosts` | ProxyHost | per-inbound host/SNI/transport override entries |
  | `exclude_inbounds_association` | (assoc) | proxy ↔ excluded inbound tags |
  | `template_inbounds_association` | (assoc) | template ↔ inbound tags |
  | `system` | System | singleton global uplink/downlink counters |
  | `jwt` | JWT | persisted signing secret |
  | `tls` | TLS | panel client cert/key for node mТLS |
  | `nodes` | Node | remote node records (address/ports/status/coefficient) |
  | `node_user_usages` | NodeUserUsage | hourly per-node-per-user traffic |
  | `node_usages` | NodeUsage | hourly per-node uplink/downlink |
  | `notification_reminders` | NotificationReminder | dedupe sent usage/expiry reminders |

  (17 ORM classes incl. the 2 association tables.)

### Xray binary
- **NOT pinned** — installed as **latest** at build via
  `curl …/Marzban-scripts/raw/master/install_latest_xray.sh | bash` (`Dockerfile:11`). There is no
  version lock; the binary version is whatever "latest" is at image-build time. Runtime path
  `XRAY_EXECUTABLE_PATH=/usr/local/bin/xray`, assets `/usr/local/share/xray` (`config.py:32-33`).
  Node minimum version hint `min_node_version="v0.2.0"` (`app/models/node.py:15`).

### Telegram bot
- **pyTelegramBotAPI (`telebot`) 4.9.0** (`requirements.txt:26`); runs `infinity_polling` in a daemon
  thread (`app/telegram/__init__.py:27-28`). Optional proxy via `TELEGRAM_PROXY_URL`.

---

## 5. Test Coverage

- **There are NO tests.** No `test_*.py`, `*_test.py`, `conftest.py`, `tests/` directory, `pytest.ini`,
  `tox.ini`, or CI test config anywhere in the repo (frontend `node_modules` excluded).
- **Test runner:** none configured. No pytest/unittest setup, no coverage tooling.
- **Integration tests:** none. **Unit tests:** none.
- Implication for v0.9.0: every critical path documented in §3 (node reconnect, status transitions,
  subscription generation per format, config generation, flow-stripping) is currently unverified by
  automated tests. This is the single biggest stability risk surface.

---

## 6. Pain Points (specific)

1. **No automated tests at all** (§5). Highest-priority gap for a "stability release."

2. **Mutable/eval-once default argument** — `add_notification_reminders(db, user, now: datetime =
   datetime.utcnow())` (`app/jobs/review_users.py:20`). The default is evaluated once at import, so
   `now` is frozen at process start for every call that omits it. (Currently always called with an
   explicit `now`, but it's a latent bug.)

3. **Connection errors logged at INFO without exception text** — `connect_node`/`restart_node`
   (`app/xray/operations.py:228-230,263-269`) log `logger.info("Unable to connect…")` and put the
   real error only in `Node.message`. Hard to diagnose node failures from logs.

4. **No real reconnect backoff** — rpyc connect retries spin with no sleep (`app/xray/node.py:351-354`);
   otherwise reconnection is just the fixed 10 s health-check tick. A flapping/unreachable node is
   retried aggressively and indefinitely with no exponential backoff or circuit breaker.

5. **Broad exception swallowing.** 29 `except Exception` sites plus several bare `except:`
   (`app/utils/jwt.py:79`, `app/utils/system.py:116,123,155,162`, `app/xray/config.py:247`,
   `app/telegram/handlers/admin.py:2087`). Notably the bare `except:` in `jwt.py:79` masks any
   token-decode error as "invalid token", and `config.py:247` silently ignores Reality
   public-key derivation failures. Stats collection swallows all `XrayError` → `[]`
   (`record_usages.py:117-118,126-127`), so a failing node silently reports zero usage.

6. **Sync DB session inside async websocket handlers** — `core_logs`
   (`app/routers/core.py:21`) and `node_logs` (`app/routers/node.py:83`) are `async def` but take
   `db: Session = Depends(get_db)` (blocking SQLAlchemy). DB use is brief (auth only) so impact is
   small, but it's the one place sync DB runs on the event loop rather than the threadpool.

7. **Deprecated FastAPI lifecycle** — `@app.on_event("startup")`/`("shutdown")` used throughout
   (`app/__init__.py:50,61`, `app/jobs/0_xray_core.py:37,68`, `app/telegram/__init__.py:16`,
   `app/jobs/send_notifications.py:89`). Deprecated in favor of lifespan handlers; will break on a
   future Starlette/FastAPI upgrade.

8. **DB layer imports the Xray layer** — `app/db/models.py:23 import app.xray`, and Pydantic user
   validators reference `xray.config` (`app/models/user.py:159,180,189,257`). This circular-ish
   coupling means model validation depends on Xray module global state being initialized, and makes
   the layers hard to test in isolation.

9. **`_apply_api` dead/odd code** — `config.py:67-68` assigns `inbound["listen"]` to a string then
   index-assigns into it; only the `port` reassignment is meaningful. Looks like a latent bug in the
   "API_INBOUND already exists" branch.

10. **`create_node` ignores `usage_coefficient`** from the create payload
    (`app/db/crud.py:1307-1311`); it's only honored on update. New nodes silently get coefficient 1.0
    regardless of what the admin submitted.

11. **`reseted_usage` / `lifetime_used_traffic` computed in Python by summing all reset logs**
    (`app/db/models.py:106-122`) — O(reset-logs) per access, loaded lazily; for long-lived users with
    many resets this is repeated work and can trigger N+1 lazy loads in list endpoints.

12. **`replace_existing` only on the webhook job** (`send_notifications.py:97`) but not others; the
    glob-based job loader (`app/jobs/__init__.py`) re-executing under `--reload` (DEBUG) could
    register duplicate jobs. Single-worker requirement is enforced only by convention/comment
    (`main.py:48-49`), not by code.

13. **Stats use `reset=True` deltas** (`record_usages.py:113,124`) — if a node restarts or a poll is
    missed mid-cycle, in-core counters not yet collected are lost; there's no reconciliation. Usage
    accounting is best-effort.

14. **Subscription has no per-client transport control** (§3b) — by design today, but worth flagging
    as a frequently-requested capability gap rather than a bug.

15. **`commit`/refresh-heavy CRUD + no connection retry on the request path** — MySQL deadlock retry
    exists only in the jobs' `safe_execute`, not in `crud.py` request-path writes.

---

## 7. Open Questions (please answer — these drive v0.9.0 scope)

1. **Tests:** Is adding a test suite in-scope for v0.9.0, and what's the priority order — node
   reconnect logic, user state transitions, or subscription-format correctness first? Should we
   target pytest + a SQLite in-memory fixture?

2. **Xray version pinning:** Do you want the Xray binary pinned to a specific version in the
   Dockerfile (reproducible builds) instead of "install latest"? If so, which version is the v0.9.0 baseline?

3. **Node reconnect backoff:** Should I add exponential backoff / a circuit breaker to node
   reconnection (item §6.4), or is the fixed 10 s health-check cadence intentional?

4. **Per-client transport filtering** (§3b / §6.14): Is this a feature you want in v0.9.0? If yes,
   should it be a per-user allowlist of networks, or per-inbound-tag (which already exists)? This
   shapes whether `process_inbounds_and_tags` needs reworking.

5. **rpyc node support:** Is the legacy `RPyCXRayNode` control channel still needed, or are all nodes
   on the REST agent now? Dropping rpyc would simplify `app/xray/node.py` significantly.

6. **FastAPI lifespan migration** (§6.7): OK to migrate `@app.on_event` → lifespan handlers as part
   of stability work, or keep deferred to avoid behavior changes?

7. **DB↔Xray coupling** (§6.8): Is refactoring the `app.db.models` → `app.xray` import out of scope,
   or do you want it addressed (it currently blocks isolated unit testing of models)?

8. **Logging:** Should node connection failures move from INFO to ERROR and include exception text
   (§6.3)? Any structured-logging direction you want (JSON logs)?

9. **Async DB:** Is moving to an async stack (async SQLAlchemy + async endpoints) a goal at any
   point, or is the sync-`def` + threadpool model the intended long-term design? (Affects whether
   §6.6 matters.)

10. **`usage_coefficient` at create** (§6.10): confirm this is an unintended bug I can fix, vs.
    intentional (coefficient set only after creation).

11. **Multi-worker:** Is single-worker permanent, or is horizontal scaling (externalized scheduler +
    shared Xray state) a future goal? This affects how much of the in-process-singleton design we lock in.

12. **Frontend scope:** Are the dashboard dependency upgrades (React/Vite/TS) in scope for v0.9.0, or
    is this release backend-stability only?

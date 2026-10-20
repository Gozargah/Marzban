# Как участвовать в разработке npvpn panel

npvpn panel — форк Marzban. Спасибо, что хотите помочь проекту.

## Вопросы и баги

- Вопросы по установке и настройке — в Telegram: [t.me/npvpn](https://t.me/npvpn).
- Баги и предложения — в [GitHub Issues](https://github.com/npvpn/vpn-panel/issues). Шаблоны подставятся при создании issue.

К багу приложите:

- версию образа: `docker inspect --format '{{.Config.Image}}' <контейнер>`;
- ID образа: `docker inspect --format '{{.Image}}' <контейнер>` — тег `latest` не говорит, какая это сборка, а ID указывает на точную;
- ожидаемое и фактическое поведение;
- логи панели;
- конфиг xray и значимые переменные `.env` — без секретов (пароли, токены, ключи).

## Локальная разработка

Нужны [uv](https://docs.astral.sh/uv/), Python 3.12 и, для сборки дашборда, Node.js с npm.

Установить зависимости:

```bash
uv sync --all-groups
```

Проверки — те же, что запускает CI (`.github/workflows/ci.yml`):

```bash
uv run ruff check .
uv run ruff format --check .
uv run mypy app | uv run mypy-baseline filter
uv run pytest -q
```

`mypy-baseline filter` пропускает уже известные ошибки типов (список в `mypy-baseline.txt`) и падает только на новых.

Дашборд собирается скриптом `build_dashboard.sh`: он запускает `npm run build` в `app/dashboard` и копирует `index.html` в `404.html`. Перед этим выполните `npm ci` в `app/dashboard`.

Запуск панели локально. Нужен бинарник Xray: по умолчанию панель ищет его в `/usr/local/bin/xray`; другой путь задаётся переменной `XRAY_EXECUTABLE_PATH` в `.env`, а каталог с geo-файлами — `XRAY_ASSETS_PATH`. Без Xray не запустятся ни `alembic`, ни `main.py`. Скопируйте `.env.example` в `.env`, при необходимости поправьте значения, примените миграции и запустите панель:

```bash
uv run alembic upgrade head
uv run python main.py
```

По умолчанию панель слушает порт 8000, база — SQLite (`db.sqlite3` в текущем каталоге). Проще всего получить рабочее окружение сразу с Xray через Docker-образ (`docker build -t npvpn-panel .`).

## Структура проекта

- `app/` — приложение FastAPI:
  - `routers/` — HTTP API;
  - `services/` — бизнес-логика;
  - `models/` — pydantic-модели API;
  - `db/` — модели SQLAlchemy, crud и миграции (`db/migrations/`);
  - `xray/` — сборка конфигов xray, работа с нодами;
  - `subscription/` — формирование подписок;
  - `jobs/` — фоновые задачи;
  - `telegram/`, `discord/` — уведомления;
  - `utils/`, `templates/` — вспомогательный код и шаблоны;
  - `dashboard/` — исходники веб-интерфейса;
- `cli/` — команды `marzban cli`;
- `tests/` — тесты pytest;
- `docs/` — документация, архитектура — в [docs/architecture.md](docs/architecture.md);
- `scripts/` — вспомогательные скрипты;
- `main.py` — точка входа uvicorn, `config.py` — настройки из переменных окружения.

## Pull request

- Ветку создавайте от `master`, PR открывайте в `master`.
- PR сливается только через squash, поэтому заголовок PR станет коммитом: пишите его коротко и по сути.
- В описании: что и зачем сделано, список изменений, на что обратить внимание при ревью.
- Новая логика приходит вместе с тестами.
- Изменения схемы БД — только через `alembic revision`, не вручную.
- Перед PR прогоните проверки из раздела «Локальная разработка».

## Лицензия

Вклад принимается на условиях AGPL-3.0, как и весь проект.

## In English

- Questions: Telegram, [t.me/npvpn](https://t.me/npvpn). Bugs and feature requests: [GitHub Issues](https://github.com/npvpn/vpn-panel/issues).
- Setup: `uv sync --all-groups`.
- Checks (same as CI): `uv run ruff check .`, `uv run ruff format --check .`, `uv run mypy app | uv run mypy-baseline filter`, `uv run pytest -q`.
- Run locally: an Xray binary is required (default `/usr/local/bin/xray`, override with `XRAY_EXECUTABLE_PATH`); copy `.env.example` to `.env`, run `uv run alembic upgrade head`, then `uv run python main.py`.
- Branch from `master` and open the PR against `master`; PRs are squash-merged, so the PR title becomes the commit message.
- New logic needs tests; DB schema changes only via `alembic revision`.
- Contributions are accepted under AGPL-3.0.

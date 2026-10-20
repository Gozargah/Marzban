"""Сторож: вся цепочка миграций должна проходить на свежей SQLite.

Прод живёт на MySQL, но первый сценарий публичной инструкции по установке —
SQLite. Миграция, использующая ALTER для ограничений вне batch-режима
(как первая версия 8908de20cb61), роняет старт панели; этот тест ловит такое
до релиза.

alembic запускается в процессе: env.py берёт URL из config.SQLALCHEMY_DATABASE_URL
(константа модуля, импортируется при каждом запуске env.py), поэтому её
подменяем monkeypatch'ем на файловую базу в tmp_path. app в тестах уже
заглушён conftest.py, так что xray и FastAPI не нужны. env.py тянет модели, а те —
app.subscription.share, который при импорте ходит в сеть за публичным IP; его
подменяем заглушкой на время теста (тот же приём, что в test_expire_bigint_migration.py).
Предупреждения DeprecationWarning приходят из самих старых миграций и не относятся к сторожу.
"""

from __future__ import annotations

import pathlib
import sys
import types

import pytest
import sqlalchemy as sa
from alembic import command
from alembic.config import Config
from alembic.script import ScriptDirectory

import config as panel_config

pytestmark = pytest.mark.filterwarnings("ignore::DeprecationWarning")

ROOT = pathlib.Path(__file__).resolve().parent.parent
PREV_REVISION = "63fd9271f310"
OWNER_REVISION = "8908de20cb61"


@pytest.fixture
def alembic_cfg(tmp_path, monkeypatch):
    share_stub = types.ModuleType("app.subscription.share")
    share_stub.generate_v2ray_links = lambda *_args, **_kwargs: []
    monkeypatch.setitem(sys.modules, "app.subscription.share", share_stub)
    db_url = f"sqlite:///{tmp_path / 'fresh.sqlite3'}"
    monkeypatch.setattr(panel_config, "SQLALCHEMY_DATABASE_URL", db_url)
    cfg = Config()
    cfg.set_main_option("script_location", str(ROOT / "app" / "db" / "migrations"))
    cfg.attributes["db_url"] = db_url
    return cfg


def _engine(cfg: Config) -> sa.Engine:
    return sa.create_engine(cfg.attributes["db_url"])


def _current_revision(engine: sa.Engine) -> str | None:
    with engine.connect() as conn:
        return conn.execute(sa.text("SELECT version_num FROM alembic_version")).scalar()


def test_fresh_sqlite_reaches_head(alembic_cfg):
    heads = ScriptDirectory.from_config(alembic_cfg).get_heads()
    assert len(heads) == 1

    command.upgrade(alembic_cfg, "head")

    engine = _engine(alembic_cfg)
    try:
        assert _current_revision(engine) == heads[0]
    finally:
        engine.dispose()


def test_half_applied_8908_recovers(alembic_cfg):
    command.upgrade(alembic_cfg, PREV_REVISION)

    # Ровно то, что оставляла старая версия миграции перед падением на create_foreign_key.
    engine = _engine(alembic_cfg)
    try:
        with engine.begin() as conn:
            conn.execute(sa.text("ALTER TABLE nodes ADD COLUMN owner_bot_id INTEGER"))
            conn.execute(sa.text("CREATE INDEX ix_nodes_owner_bot_id ON nodes (owner_bot_id)"))
        assert _current_revision(engine) == PREV_REVISION
    finally:
        engine.dispose()

    command.upgrade(alembic_cfg, "head")

    engine = _engine(alembic_cfg)
    try:
        inspector = sa.inspect(engine)
        fks = [fk for fk in inspector.get_foreign_keys("nodes") if fk["referred_table"] == "bots"]
        assert len(fks) == 1
        assert fks[0]["constrained_columns"] == ["owner_bot_id"]
        assert fks[0]["options"].get("ondelete") == "SET NULL"
        assert "billable" in {c["name"] for c in inspector.get_columns("bot_bs_daily")}
        index_names = [ix["name"] for ix in inspector.get_indexes("nodes")]
        assert index_names.count("ix_nodes_owner_bot_id") == 1
    finally:
        engine.dispose()


def test_8908_downgrade_on_sqlite(alembic_cfg):
    command.upgrade(alembic_cfg, OWNER_REVISION)
    command.downgrade(alembic_cfg, PREV_REVISION)

    engine = _engine(alembic_cfg)
    try:
        inspector = sa.inspect(engine)
        assert "owner_bot_id" not in {c["name"] for c in inspector.get_columns("nodes")}
        assert "billable" not in {c["name"] for c in inspector.get_columns("bot_bs_daily")}
    finally:
        engine.dispose()

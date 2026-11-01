"""Upgrade paths: existing installations keep their data and the chain stays linear."""
import sqlite3
from pathlib import Path

from alembic.config import Config
from alembic.script import ScriptDirectory

from tests.conftest import ROOT, run_alembic

PRIOR_HEAD = "31d941bdb713"  # last revision before the host extras / usage ratio work
HEAD = "d4f8b1a6c3e9"


def script() -> ScriptDirectory:
    cfg = Config(str(ROOT / "alembic.ini"))
    cfg.set_main_option("script_location", str(ROOT / "app" / "db" / "migrations"))
    return ScriptDirectory.from_config(cfg)


def query(db_file: Path, sql: str):
    with sqlite3.connect(db_file) as conn:
        return conn.execute(sql).fetchall()


def test_single_linear_head():
    heads = script().get_heads()
    assert heads == [HEAD], f"expected one head, got {heads} (rebase new migrations onto the current head)"


def test_upgrade_preserves_hosts_and_backfills_mux(tmp_db_file):
    run_alembic("upgrade", PRIOR_HEAD, db_file=tmp_db_file)
    with sqlite3.connect(tmp_db_file) as conn:
        conn.execute("insert into inbounds (id, tag) values (1, 'VLESS WS')")
        conn.execute(
            "insert into hosts (remark, address, inbound_tag, security, alpn, fingerprint, mux_enable,"
            " random_user_agent, use_sni_as_host) values ('muxed','a.com','VLESS WS','tls','none','none',1,0,0)")
        conn.execute(
            "insert into hosts (remark, address, inbound_tag, security, alpn, fingerprint, mux_enable,"
            " random_user_agent, use_sni_as_host) values ('plain','b.com','VLESS WS','none','none','none',0,0,0)")

    run_alembic("upgrade", "head", db_file=tmp_db_file)

    rows = {r[0]: r for r in query(tmp_db_file, "select remark, security, mux_settings, tls_extra from hosts")}
    assert rows["muxed"][1] == "tls" and rows["plain"][1] == "none"
    assert '"enabled": true' in rows["muxed"][2].lower().replace('":true', '": true')
    assert rows["plain"][2] is None and rows["muxed"][3] is None
    assert query(tmp_db_file, "select usage_coefficient from inbounds")[0][0] == 1.0
    assert query(tmp_db_file, "select version_num from alembic_version")[0][0] == HEAD
    assert query(tmp_db_file, "select count(*) from inbound_usages")[0][0] == 0


def test_downgrade_then_upgrade_again(tmp_db_file):
    run_alembic("upgrade", "head", db_file=tmp_db_file)
    with sqlite3.connect(tmp_db_file) as conn:
        conn.execute("insert into inbounds (id, tag, usage_coefficient) values (1, 'VLESS WS', 2.5)")
        conn.execute(
            "insert into hosts (remark, address, inbound_tag, security, alpn, fingerprint, mux_enable,"
            " random_user_agent, use_sni_as_host, reality_extra) values"
            " ('r','a.com','VLESS WS','reality','none','none',0,0,0,'{\"public_key\": \"p\"}')")

    run_alembic("downgrade", PRIOR_HEAD, db_file=tmp_db_file)
    assert query(tmp_db_file, "select version_num from alembic_version")[0][0] == PRIOR_HEAD
    # a reality host cannot exist in the old schema: it is demoted, not lost
    assert query(tmp_db_file, "select security from hosts")[0][0] == "inbound_default"

    run_alembic("upgrade", "head", db_file=tmp_db_file)
    assert query(tmp_db_file, "select version_num from alembic_version")[0][0] == HEAD
    assert query(tmp_db_file, "select count(*) from hosts")[0][0] == 1


def test_upgrade_is_idempotent_when_objects_already_exist(tmp_db_file):
    """A DB that already has the objects (restored from a fork) must not fail the upgrade."""
    run_alembic("upgrade", "head", db_file=tmp_db_file)
    with sqlite3.connect(tmp_db_file) as conn:
        conn.execute("update alembic_version set version_num = ?", (PRIOR_HEAD,))
    run_alembic("upgrade", "head", db_file=tmp_db_file)
    assert query(tmp_db_file, "select version_num from alembic_version")[0][0] == HEAD

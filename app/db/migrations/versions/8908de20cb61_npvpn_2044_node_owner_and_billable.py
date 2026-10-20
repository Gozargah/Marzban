"""npvpn_2044_node_owner_and_billable

Дефект (NPVPN-2044.1): партнёрские БС-ноды (сервер партнёра, за который он
платит сам — is_bs=True у такой ноды значит только «на ней действует БС-лимит»,
а не «мы её арендуем») биллились наравне с нашими. У AppleGurruBot, например,
весь БС-трафик за 30 дней — 163.2 ГБ — лежит на его собственной ноде 29, и
полностью уходил бы в счёт как наш ресурс.

Добавляет:
  - nodes.owner_bot_id — чей это сервер (NULL = наш, непусто = сервер бота,
    его трафик не биллим). FK на bots с ON DELETE SET NULL: удаление бота не
    должно удалять ноду.
  - bot_bs_daily.billable — классификация, зафиксированная в момент записи
    агрегата (см. докстринг BotBsDaily и record_bot_bs_daily). server_default
    TRUE: если какой-то путь записи забудет явно проставить колонку, строка
    попадёт в счёт, а не потеряется молча — недосчёт в биллинге хуже, чем
    лишняя видимая строка.

История и owner_bot_id — почему ручного SQL при деплое НЕТ:
  owner_bot_id рождается этой же миграцией, поэтому на момент применения
  классифицировать уже накопленную историю по владельцу нечем — колонки ещё
  не существовало, когда исторические строки писались (как джобой, так и
  предыдущим бэкфиллом 63fd9271f310). Поэтому эта миграция сразу помечает
  ВСЁ, что уже лежит в bot_bs_daily на момент применения, как billable=0:
  БС-трафик партнёрам до этого релиза не биллился никогда (сервиса "счёт за
  БС" не существовало), и задним числом выставлять счёт за период, когда
  механизма ещё не было, мы не станем — независимо от того, чья на самом деле
  была нода. С этого релиза billable решает код (record_bot_bs_daily) по
  актуальному nodes.owner_bot_id в момент первой записи строки за сутки.

  Следствие: сутки, в которые пришёлся деплой, останутся целиком billable=0,
  включая трафик, записанный уже после раскатки (при конфликте UPSERT не
  трогает billable — см. докстринг record_bot_bs_daily). Это максимум одни
  сутки, и ошибка в сторону недосчёта, а не переплаты партнёра — это
  ожидаемо, не "пропавший" день.

Revision ID: 8908de20cb61
Revises: 63fd9271f310
Create Date: 2026-10-06 08:29:18.851720

"""

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision = "8908de20cb61"
down_revision = "63fd9271f310"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # SQLite не умеет ALTER для ограничений, поэтому nodes правим в batch-режиме (на MySQL
    # это обычные ALTER). DDL в SQLite не транзакционный: первая версия миграции падала
    # на внешнем ключе, оставив колонку и индекс без сдвига ревизии, поэтому уже созданное пропускаем.
    inspector = sa.inspect(op.get_bind())
    has_column = any(c["name"] == "owner_bot_id" for c in inspector.get_columns("nodes"))
    has_index = any(i["name"] == "ix_nodes_owner_bot_id" for i in inspector.get_indexes("nodes"))

    with op.batch_alter_table("nodes") as batch_op:
        if not has_column:
            batch_op.add_column(sa.Column("owner_bot_id", sa.Integer(), nullable=True))
        if not has_index:
            batch_op.create_index(op.f("ix_nodes_owner_bot_id"), ["owner_bot_id"], unique=False)
        batch_op.create_foreign_key(
            "fk_nodes_owner_bot_id_bots",
            "bots",
            ["owner_bot_id"],
            ["id"],
            ondelete="SET NULL",
        )

    op.add_column(
        "bot_bs_daily",
        sa.Column(
            "billable",
            sa.Boolean(),
            nullable=False,
            server_default=sa.text("1"),
        ),
    )

    # Вся история, уже лежащая в bot_bs_daily на момент применения миграции
    # (джоба + предыдущий бэкфилл 63fd9271f310), классифицировать по владельцу
    # нечем — owner_bot_id только что появился. БС-трафик партнёрам до этого
    # релиза никогда не биллился, поэтому эта история в счёт не идёт целиком.
    op.execute(sa.text("UPDATE bot_bs_daily SET billable = 0"))


def downgrade() -> None:
    op.drop_column("bot_bs_daily", "billable")

    with op.batch_alter_table("nodes") as batch_op:
        batch_op.drop_constraint("fk_nodes_owner_bot_id_bots", type_="foreignkey")
        batch_op.drop_index(op.f("ix_nodes_owner_bot_id"))
        batch_op.drop_column("owner_bot_id")

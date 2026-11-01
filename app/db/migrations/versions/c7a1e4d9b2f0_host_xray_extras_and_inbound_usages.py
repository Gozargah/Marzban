"""host xray extras (tls/reality/xhttp/mux) and inbound usages

Revision ID: c7a1e4d9b2f0
Revises: 31d941bdb713
Create Date: 2026-11-01 12:00:00.000000

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = "c7a1e4d9b2f0"
down_revision = "31d941bdb713"
branch_labels = None
depends_on = None

old_security = sa.Enum("inbound_default", "none", "tls", name="proxyhostsecurity")
new_security = sa.Enum("inbound_default", "none", "tls", "reality", name="proxyhostsecurity")


def _columns(table: str) -> set:
    return {column["name"] for column in sa.inspect(op.get_bind()).get_columns(table)}


def upgrade() -> None:
    # Idempotent: a database restored from a fork or a partially applied run must not break the upgrade.
    existing = _columns("hosts")
    with op.batch_alter_table("hosts") as batch_op:
        for name in ("tls_extra", "reality_extra", "xhttp_extra", "mux_settings"):
            if name not in existing:
                batch_op.add_column(sa.Column(name, sa.JSON(), nullable=True))
        batch_op.alter_column(
            "security",
            existing_type=old_security,
            type_=new_security,
            existing_nullable=False,
            existing_server_default="inbound_default",
        )

    # Backfill the structured mux settings from the legacy boolean flag.
    hosts = sa.table("hosts", sa.column("mux_enable", sa.Boolean), sa.column("mux_settings", sa.JSON))
    op.execute(
        hosts.update()
        .where(hosts.c.mux_enable.is_(True), hosts.c.mux_settings.is_(None))
        .values(mux_settings={"enabled": True})
    )

    if "inbound_usages" in sa.inspect(op.get_bind()).get_table_names():
        return

    op.create_table(
        "inbound_usages",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.Column("inbound_tag", sa.String(256), nullable=False),
        sa.Column("node_id", sa.Integer(), sa.ForeignKey("nodes.id"), nullable=True),
        sa.Column("uplink", sa.BigInteger(), nullable=False, server_default="0"),
        sa.Column("downlink", sa.BigInteger(), nullable=False, server_default="0"),
        sa.UniqueConstraint("created_at", "inbound_tag", "node_id"),
    )
    op.create_index("ix_inbound_usages_inbound_tag", "inbound_usages", ["inbound_tag"])


def downgrade() -> None:
    if "inbound_usages" in sa.inspect(op.get_bind()).get_table_names():
        op.drop_index("ix_inbound_usages_inbound_tag", table_name="inbound_usages")
        op.drop_table("inbound_usages")

    hosts = sa.table("hosts", sa.column("security", sa.String))
    op.execute(hosts.update().where(hosts.c.security == "reality").values(security="inbound_default"))

    with op.batch_alter_table("hosts") as batch_op:
        batch_op.alter_column(
            "security",
            existing_type=new_security,
            type_=old_security,
            existing_nullable=False,
            existing_server_default="inbound_default",
        )
        for name in ("mux_settings", "xhttp_extra", "reality_extra", "tls_extra"):
            batch_op.drop_column(name)

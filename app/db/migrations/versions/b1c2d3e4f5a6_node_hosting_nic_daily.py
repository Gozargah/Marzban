"""node_hosting_nic_daily — суточный NIC in+out с нод (sidecar → панель).

Revision ID: b1c2d3e4f5a6
Revises: 8908de20cb61
Create Date: 2026-03-17

"""

import sqlalchemy as sa
from alembic import op

revision = "b1c2d3e4f5a6"
down_revision = "8908de20cb61"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "node_hosting_nic_daily",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("node_id", sa.Integer(), nullable=False),
        sa.Column("day", sa.Date(), nullable=False),
        sa.Column("used_bytes", sa.BigInteger(), nullable=False, server_default="0"),
        sa.Column("updated_at", sa.DateTime(), nullable=True),
        sa.ForeignKeyConstraint(["node_id"], ["nodes.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("node_id", "day", name="uq_node_hosting_nic_daily"),
    )
    op.create_index("ix_node_hosting_nic_daily_day", "node_hosting_nic_daily", ["day"], unique=False)
    op.create_index("ix_node_hosting_nic_daily_node_id", "node_hosting_nic_daily", ["node_id"], unique=False)


def downgrade() -> None:
    op.drop_index("ix_node_hosting_nic_daily_node_id", table_name="node_hosting_nic_daily")
    op.drop_index("ix_node_hosting_nic_daily_day", table_name="node_hosting_nic_daily")
    op.drop_table("node_hosting_nic_daily")

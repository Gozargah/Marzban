"""add smart_dns_name and smart_dns_announce_ip to nodes

Revision ID: e5f6a7b8c9d0
Revises: d4e5f6a7b8c9
Create Date: 2026-04-03

"""
from alembic import op
import sqlalchemy as sa

revision = "e5f6a7b8c9d0"
down_revision = "d4e5f6a7b8c9"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "nodes",
        sa.Column("smart_dns_name", sa.String(length=256), nullable=True),
    )
    op.add_column(
        "nodes",
        sa.Column("smart_dns_announce_ip", sa.String(length=64), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("nodes", "smart_dns_announce_ip")
    op.drop_column("nodes", "smart_dns_name")

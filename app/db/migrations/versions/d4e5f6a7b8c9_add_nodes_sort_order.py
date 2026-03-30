"""add nodes sort_order

Revision ID: d4e5f6a7b8c9
Revises: c8f9a1b2d3e4
Create Date: 2026-03-30

"""
from alembic import op
import sqlalchemy as sa


revision = "d4e5f6a7b8c9"
down_revision = "c8f9a1b2d3e4"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "nodes",
        sa.Column(
            "sort_order",
            sa.Integer(),
            nullable=False,
            server_default=sa.text("0"),
        ),
    )
    op.execute(sa.text("UPDATE nodes SET sort_order = id"))


def downgrade() -> None:
    op.drop_column("nodes", "sort_order")

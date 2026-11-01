"""add usage coefficient to inbounds

Revision ID: d4f8b1a6c3e9
Revises: c7a1e4d9b2f0
Create Date: 2026-11-01 15:00:00.000000

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = "d4f8b1a6c3e9"
down_revision = "c7a1e4d9b2f0"
branch_labels = None
depends_on = None


def upgrade() -> None:
    if "usage_coefficient" in {c["name"] for c in sa.inspect(op.get_bind()).get_columns("inbounds")}:
        return
    with op.batch_alter_table("inbounds") as batch_op:
        batch_op.add_column(sa.Column("usage_coefficient", sa.Float(), nullable=False, server_default="1"))


def downgrade() -> None:
    with op.batch_alter_table("inbounds") as batch_op:
        batch_op.drop_column("usage_coefficient")

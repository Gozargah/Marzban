"""add last_ip to user_devices

Revision ID: c77c9061b8d4
Revises: b1c2d3e4f5a6
Create Date: 2026-10-15 10:21:24.938139

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = 'c77c9061b8d4'
down_revision = 'b1c2d3e4f5a6'
branch_labels = None
depends_on = None


def upgrade() -> None:
    with op.batch_alter_table("user_devices") as batch_op:
        batch_op.add_column(sa.Column("last_ip", sa.String(length=45), nullable=True))


def downgrade() -> None:
    with op.batch_alter_table("user_devices") as batch_op:
        batch_op.drop_column("last_ip")

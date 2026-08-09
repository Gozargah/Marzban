"""per-user group traffic limit override (YUKU)

Revision ID: yuku0005ugl
Revises: yuku0004groups
Create Date: 2026-06-15

Adds an optional per-user override of a group's traffic_limit. NULL = use the
group's default limit. Additive, inert until an override is set.
"""
from alembic import op
import sqlalchemy as sa


revision = 'yuku0005ugl'
down_revision = 'yuku0004groups'
branch_labels = None
depends_on = None


def upgrade() -> None:
    with op.batch_alter_table('user_group_usage') as batch_op:
        batch_op.add_column(sa.Column('traffic_limit', sa.BigInteger(), nullable=True))


def downgrade() -> None:
    with op.batch_alter_table('user_group_usage') as batch_op:
        batch_op.drop_column('traffic_limit')

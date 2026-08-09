"""hard group-limit enforcement flag (YUKU)

Revision ID: yuku0007enf
Revises: yuku0006mm
Create Date: 2026-06-15

- user_group_usage.enforced: True while the user is actively cut off from the
  group's inbounds for exceeding the group traffic limit. Used to know when to
  re-add them (limit reset / raised / membership removed). Defaults to 0, so
  existing rows are "not enforced" and nothing changes on deploy.
"""
from alembic import op
import sqlalchemy as sa


revision = 'yuku0007enf'
down_revision = 'yuku0006mm'
branch_labels = None
depends_on = None


def upgrade() -> None:
    with op.batch_alter_table('user_group_usage') as batch_op:
        batch_op.add_column(sa.Column('enforced', sa.Boolean(), nullable=False,
                                      server_default=sa.text('0')))


def downgrade() -> None:
    with op.batch_alter_table('user_group_usage') as batch_op:
        batch_op.drop_column('enforced')

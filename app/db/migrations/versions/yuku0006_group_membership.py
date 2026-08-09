"""group membership + master-node support (YUKU)

Revision ID: yuku0006mm
Revises: yuku0005ugl
Create Date: 2026-06-15

- user_group_usage.member: only members see the limit / get enforced.
  Existing rows with an explicit override are backfilled as members.
- host_groups.include_master: meter the panel's own xray (node_id NULL) too.
"""
from alembic import op
import sqlalchemy as sa


revision = 'yuku0006mm'
down_revision = 'yuku0005ugl'
branch_labels = None
depends_on = None


def upgrade() -> None:
    with op.batch_alter_table('user_group_usage') as batch_op:
        batch_op.add_column(sa.Column('member', sa.Boolean(), nullable=False,
                                      server_default=sa.text('0')))
    with op.batch_alter_table('host_groups') as batch_op:
        batch_op.add_column(sa.Column('include_master', sa.Boolean(), nullable=False,
                                      server_default=sa.text('0')))
    # anyone who already had an explicit per-user limit is treated as a member
    op.execute("UPDATE user_group_usage SET member = 1 WHERE traffic_limit IS NOT NULL")


def downgrade() -> None:
    with op.batch_alter_table('host_groups') as batch_op:
        batch_op.drop_column('include_master')
    with op.batch_alter_table('user_group_usage') as batch_op:
        batch_op.drop_column('member')

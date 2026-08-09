"""host traffic groups (YUKU): per-user traffic limit on a group of hosts/nodes

Revision ID: yuku0004groups
Revises: yuku0003devstatus
Create Date: 2026-06-15

Purely additive — 4 new tables, no ALTER on existing tables. With no group
configured the feature is completely inert (zero behaviour change).

  host_groups        a named group with a per-user traffic_limit + reset policy
  host_group_hosts   which client-facing hosts belong to the group (enforce/show)
  host_group_nodes   which nodes meter into the group (a node -> at most one group)
  user_group_usage   per (user, group) running counter + reset baseline
"""
from alembic import op
import sqlalchemy as sa


revision = 'yuku0004groups'
down_revision = 'yuku0003devstatus'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        'host_groups',
        sa.Column('id', sa.Integer(), primary_key=True),
        sa.Column('name', sa.String(length=128), nullable=False, unique=True),
        # per-user limit in bytes; 0/NULL = unlimited (group still tracked/shown)
        sa.Column('traffic_limit', sa.BigInteger(), nullable=True),
        sa.Column('reset_strategy', sa.String(length=16), nullable=False,
                  server_default='no_reset'),
        sa.Column('notice_text', sa.String(length=512), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=True),
    )

    op.create_table(
        'host_group_hosts',
        sa.Column('group_id', sa.Integer(),
                  sa.ForeignKey('host_groups.id', ondelete='CASCADE'), nullable=False),
        sa.Column('host_id', sa.Integer(),
                  sa.ForeignKey('hosts.id', ondelete='CASCADE'), nullable=False),
        sa.PrimaryKeyConstraint('group_id', 'host_id'),
    )

    op.create_table(
        'host_group_nodes',
        sa.Column('group_id', sa.Integer(),
                  sa.ForeignKey('host_groups.id', ondelete='CASCADE'), nullable=False),
        # a node meters into at most one group, else its traffic can't be split
        sa.Column('node_id', sa.Integer(),
                  sa.ForeignKey('nodes.id', ondelete='CASCADE'), nullable=False, unique=True),
        sa.PrimaryKeyConstraint('group_id', 'node_id'),
    )

    op.create_table(
        'user_group_usage',
        sa.Column('id', sa.Integer(), primary_key=True),
        sa.Column('user_id', sa.Integer(),
                  sa.ForeignKey('users.id', ondelete='CASCADE'), nullable=False),
        sa.Column('group_id', sa.Integer(),
                  sa.ForeignKey('host_groups.id', ondelete='CASCADE'), nullable=False),
        sa.Column('used_traffic', sa.BigInteger(), nullable=False, server_default='0'),
        sa.Column('reset_at', sa.DateTime(), nullable=True),
        sa.UniqueConstraint('user_id', 'group_id', name='uq_user_group_usage'),
    )
    op.create_index('ix_user_group_usage_group', 'user_group_usage', ['group_id'])


def downgrade() -> None:
    op.drop_index('ix_user_group_usage_group', table_name='user_group_usage')
    op.drop_table('user_group_usage')
    op.drop_table('host_group_nodes')
    op.drop_table('host_group_hosts')
    op.drop_table('host_groups')

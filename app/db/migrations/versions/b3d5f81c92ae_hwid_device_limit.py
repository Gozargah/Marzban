"""hwid device limit

Revision ID: b3d5f81c92ae
Revises: c7a1b93e4f28
Create Date: 2026-08-29

"""
import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision = 'b3d5f81c92ae'
down_revision = 'c7a1b93e4f28'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # NULL, not a default: it means "whatever the global setting says", which
    # is how every existing user carries on unaffected until somebody gives
    # them a limit of their own.
    op.add_column('users', sa.Column('hwid_device_limit', sa.Integer(), nullable=True))

    op.create_table(
        'user_devices',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('user_id', sa.Integer(), nullable=False),
        sa.Column('hwid', sa.String(length=128), nullable=False),
        sa.Column('os', sa.String(length=64), nullable=True),
        sa.Column('os_version', sa.String(length=64), nullable=True),
        sa.Column('model', sa.String(length=64), nullable=True),
        sa.Column('user_agent', sa.String(length=512), nullable=True),
        sa.Column('first_seen_at', sa.DateTime(), nullable=True),
        sa.Column('last_seen_at', sa.DateTime(), nullable=True),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ),
        sa.PrimaryKeyConstraint('id'),
        # One row per device per user. Two fetches from the same device must
        # not count twice, and the race between them is settled by the
        # database rather than by whichever request read the count first.
        sa.UniqueConstraint('user_id', 'hwid', name='uq_user_devices_user_hwid'),
    )
    op.create_index(op.f('ix_user_devices_user_id'), 'user_devices', ['user_id'], unique=False)


def downgrade() -> None:
    op.drop_index(op.f('ix_user_devices_user_id'), table_name='user_devices')
    op.drop_table('user_devices')
    op.drop_column('users', 'hwid_device_limit')

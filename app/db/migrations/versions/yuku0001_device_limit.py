"""add device_limit to users and user_devices table (YUKU)

Revision ID: yuku0001device
Revises: 2b231de97dc3
Create Date: 2026-06-14

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = 'yuku0001device'
down_revision = '2b231de97dc3'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # device_limit on users: 0 / NULL = unlimited
    with op.batch_alter_table('users') as batch_op:
        batch_op.add_column(
            sa.Column('device_limit', sa.Integer(), nullable=True, server_default='0')
        )

    op.create_table(
        'user_devices',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('user_id', sa.Integer(), nullable=False),
        sa.Column('hwid', sa.String(length=255), nullable=False),
        sa.Column('platform', sa.String(length=64), nullable=True),
        sa.Column('os_version', sa.String(length=64), nullable=True),
        sa.Column('device_model', sa.String(length=128), nullable=True),
        sa.Column('user_agent', sa.String(length=512), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=True),
        sa.Column('last_seen', sa.DateTime(), nullable=True),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('user_id', 'hwid', name='uq_user_device_hwid'),
    )
    op.create_index('ix_user_devices_user_id', 'user_devices', ['user_id'], unique=False)


def downgrade() -> None:
    op.drop_index('ix_user_devices_user_id', table_name='user_devices')
    op.drop_table('user_devices')
    with op.batch_alter_table('users') as batch_op:
        batch_op.drop_column('device_limit')

"""add device_limit and user_devices

Revision ID: 4b3c9d1a2f6e
Revises: 2b231de97dc3
Create Date: 2026-03-10 00:00:00.000000

"""
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = '4b3c9d1a2f6e'
down_revision = '2b231de97dc3'
branch_labels = None
depends_on = None


def upgrade() -> None:
    with op.batch_alter_table('users') as batch_op:
        batch_op.add_column(sa.Column('device_limit', sa.Integer(), nullable=True))

    op.create_table(
        'user_devices',
        sa.Column('id', sa.Integer(), primary_key=True),
        sa.Column('user_id', sa.Integer(), sa.ForeignKey('users.id'), nullable=False),
        sa.Column('hwid', sa.String(length=128), nullable=False),
        sa.Column('device_os', sa.String(length=64), nullable=True),
        sa.Column('ver_os', sa.String(length=64), nullable=True),
        sa.Column('device_model', sa.String(length=128), nullable=True),
        sa.Column('user_agent', sa.String(length=512), nullable=True),
        sa.Column('first_seen', sa.DateTime(), nullable=False, server_default=sa.text('CURRENT_TIMESTAMP')),
        sa.Column('last_seen', sa.DateTime(), nullable=False, server_default=sa.text('CURRENT_TIMESTAMP')),
        sa.UniqueConstraint('user_id', 'hwid', name='uq_user_devices_user_id_hwid'),
    )


def downgrade() -> None:
    op.drop_table('user_devices')
    with op.batch_alter_table('users') as batch_op:
        batch_op.drop_column('device_limit')


"""add device limit

Revision ID: 486010c6183f
Revises: 2b231de97dc3
Create Date: 2026-07-29 00:00:00.000000

"""
import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision = '486010c6183f'
down_revision = '2b231de97dc3'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column('users', sa.Column('device_limit', sa.Integer(), nullable=True))
    op.create_table(
        'user_devices',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('user_id', sa.Integer(), nullable=True),
        sa.Column('ip', sa.String(length=64), nullable=False),
        sa.Column('user_agent', sa.String(length=512), nullable=False),
        sa.Column('first_seen', sa.DateTime(), nullable=True),
        sa.Column('last_seen', sa.DateTime(), nullable=True),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('user_id', 'ip', 'user_agent', name='uq_user_device'),
    )


def downgrade() -> None:
    op.drop_table('user_devices')
    op.drop_column('users', 'device_limit')

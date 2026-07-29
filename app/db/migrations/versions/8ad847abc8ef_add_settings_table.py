"""add settings table

Revision ID: 8ad847abc8ef
Revises: 486010c6183f
Create Date: 2026-07-30 00:00:00.000000

"""
import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision = '8ad847abc8ef'
down_revision = '486010c6183f'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        'settings',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('sub_profile_title', sa.String(length=256), nullable=True),
        sa.Column('sub_support_url', sa.String(length=1024), nullable=True),
        sa.Column('sub_update_interval', sa.String(length=16), nullable=True),
        sa.Column('active_status_text', sa.String(length=256), nullable=True),
        sa.Column('expired_status_text', sa.String(length=256), nullable=True),
        sa.Column('limited_status_text', sa.String(length=256), nullable=True),
        sa.Column('disabled_status_text', sa.String(length=256), nullable=True),
        sa.Column('onhold_status_text', sa.String(length=256), nullable=True),
        sa.Column('device_limit_exceeded_message', sa.String(length=1024), nullable=True),
        sa.PrimaryKeyConstraint('id'),
    )


def downgrade() -> None:
    op.drop_table('settings')

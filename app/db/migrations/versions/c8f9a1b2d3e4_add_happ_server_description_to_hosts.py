"""add happ_server_description to hosts

Revision ID: c8f9a1b2d3e4
Revises: a1b2c3d4e5f6
Create Date: 2026-03-24

"""
from alembic import op
import sqlalchemy as sa

revision = 'c8f9a1b2d3e4'
down_revision = 'a1b2c3d4e5f6'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        'hosts',
        sa.Column('happ_server_description', sa.String(length=64), nullable=True),
    )


def downgrade() -> None:
    op.drop_column('hosts', 'happ_server_description')

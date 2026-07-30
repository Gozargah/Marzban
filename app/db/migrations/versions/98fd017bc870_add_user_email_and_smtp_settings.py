"""add user email and smtp settings

Revision ID: 98fd017bc870
Revises: 894c1f6c1513
Create Date: 2026-07-30 00:00:00.000000

"""
import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision = '98fd017bc870'
down_revision = '894c1f6c1513'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column('users', sa.Column('email', sa.String(length=254), nullable=True))
    op.add_column('settings', sa.Column('smtp_host', sa.String(length=256), nullable=True))
    op.add_column('settings', sa.Column('smtp_port', sa.Integer(), nullable=True))
    op.add_column('settings', sa.Column('smtp_username', sa.String(length=256), nullable=True))
    op.add_column('settings', sa.Column('smtp_password', sa.String(length=256), nullable=True))
    op.add_column('settings', sa.Column('smtp_from_email', sa.String(length=254), nullable=True))


def downgrade() -> None:
    op.drop_column('settings', 'smtp_from_email')
    op.drop_column('settings', 'smtp_password')
    op.drop_column('settings', 'smtp_username')
    op.drop_column('settings', 'smtp_port')
    op.drop_column('settings', 'smtp_host')
    op.drop_column('users', 'email')

"""add resend email settings

Revision ID: a1c8f4e2b7d3
Revises: e7a3c9d5f1b8
Create Date: 2026-08-06 10:50:00.000000

"""
import sqlalchemy as sa
from alembic import op

revision = 'a1c8f4e2b7d3'
down_revision = 'e7a3c9d5f1b8'
branch_labels = None
depends_on = None


def upgrade() -> None:
    with op.batch_alter_table('settings') as batch_op:
        batch_op.add_column(sa.Column('resend_api_key', sa.String(length=256), nullable=True))
        batch_op.add_column(sa.Column('resend_from_email', sa.String(length=254), nullable=True))


def downgrade() -> None:
    with op.batch_alter_table('settings') as batch_op:
        batch_op.drop_column('resend_from_email')
        batch_op.drop_column('resend_api_key')

"""add email from name

Revision ID: d4f7a2c9e6b1
Revises: b6e9d3a5c1f7
Create Date: 2026-08-06 11:55:00.000000

"""
import sqlalchemy as sa
from alembic import op

revision = 'd4f7a2c9e6b1'
down_revision = 'b6e9d3a5c1f7'
branch_labels = None
depends_on = None


def upgrade() -> None:
    with op.batch_alter_table('settings') as batch_op:
        batch_op.add_column(sa.Column('email_from_name', sa.String(length=128), nullable=True))


def downgrade() -> None:
    with op.batch_alter_table('settings') as batch_op:
        batch_op.drop_column('email_from_name')

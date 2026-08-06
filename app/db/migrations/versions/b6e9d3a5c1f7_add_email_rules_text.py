"""add email rules text

Revision ID: b6e9d3a5c1f7
Revises: a1c8f4e2b7d3
Create Date: 2026-08-06 11:10:00.000000

"""
import sqlalchemy as sa
from alembic import op

revision = 'b6e9d3a5c1f7'
down_revision = 'a1c8f4e2b7d3'
branch_labels = None
depends_on = None


def upgrade() -> None:
    with op.batch_alter_table('settings') as batch_op:
        batch_op.add_column(sa.Column('email_rules_text', sa.String(length=2048), nullable=True))


def downgrade() -> None:
    with op.batch_alter_table('settings') as batch_op:
        batch_op.drop_column('email_rules_text')

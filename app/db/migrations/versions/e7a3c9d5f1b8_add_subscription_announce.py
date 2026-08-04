"""add subscription announce fields

Revision ID: e7a3c9d5f1b8
Revises: c4d9f2b6a1e3
Create Date: 2026-08-04 14:00:00.000000

"""
import sqlalchemy as sa
from alembic import op

revision = 'e7a3c9d5f1b8'
down_revision = 'c4d9f2b6a1e3'
branch_labels = None
depends_on = None


def upgrade() -> None:
    with op.batch_alter_table('settings') as batch_op:
        batch_op.add_column(sa.Column('sub_announce', sa.String(length=1024), nullable=True))
        batch_op.add_column(sa.Column('sub_announce_url', sa.String(length=1024), nullable=True))


def downgrade() -> None:
    with op.batch_alter_table('settings') as batch_op:
        batch_op.drop_column('sub_announce_url')
        batch_op.drop_column('sub_announce')

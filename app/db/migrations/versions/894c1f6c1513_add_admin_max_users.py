"""add admin max_users

Revision ID: 894c1f6c1513
Revises: d6ea487e3e9b
Create Date: 2026-07-30 00:00:00.000000

"""
import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision = '894c1f6c1513'
down_revision = 'd6ea487e3e9b'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column('admins', sa.Column('max_users', sa.Integer(), nullable=True))


def downgrade() -> None:
    op.drop_column('admins', 'max_users')

"""add admin limits

Revision ID: d6ea487e3e9b
Revises: 8ad847abc8ef
Create Date: 2026-07-30 00:00:00.000000

"""
import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision = 'd6ea487e3e9b'
down_revision = '8ad847abc8ef'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column('admins', sa.Column('users_usage_limit', sa.BigInteger(), nullable=True))
    op.add_column('admins', sa.Column('max_users_data_limit', sa.BigInteger(), nullable=True))
    op.add_column('admins', sa.Column('expire_date', sa.DateTime(), nullable=True))


def downgrade() -> None:
    op.drop_column('admins', 'expire_date')
    op.drop_column('admins', 'max_users_data_limit')
    op.drop_column('admins', 'users_usage_limit')

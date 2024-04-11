"""add column used_traffic to admins table

Revision ID: 0976220c4786
Revises: dd725e4d3628
Create Date: 2024-04-11 23:03:07.763374

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = '0976220c4786'
down_revision = 'dd725e4d3628'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column('admins', sa.Column('used_traffic', sa.BigInteger(), nullable=False, server_default=sa.text("0")))


def downgrade() -> None:
    op.drop_column('admins', 'used_traffic')
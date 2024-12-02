"""fix multiple heads error

Revision ID: be0c5f840473
Revises: d0a3960f5dad, 54c4b8c525fc
Create Date: 2024-12-02 15:41:08.152196

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = 'be0c5f840473'
down_revision = ('d0a3960f5dad', '54c4b8c525fc')
branch_labels = None
depends_on = None


def upgrade() -> None:
    pass


def downgrade() -> None:
    pass

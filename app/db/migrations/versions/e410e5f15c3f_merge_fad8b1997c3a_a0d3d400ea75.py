"""merge fad8b1997c3a & a0d3d400ea75

Revision ID: e410e5f15c3f
Revises: fad8b1997c3a, a0d3d400ea75
Create Date: 2023-03-20 14:06:53.709408

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = 'e410e5f15c3f'
down_revision = ('fad8b1997c3a', 'a0d3d400ea75')
branch_labels = None
depends_on = None


def upgrade() -> None:
    pass


def downgrade() -> None:
    pass

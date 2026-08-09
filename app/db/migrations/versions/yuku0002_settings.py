"""add yuku_settings key-value table (YUKU)

Revision ID: yuku0002settings
Revises: yuku0001device
Create Date: 2026-06-15

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = 'yuku0002settings'
down_revision = 'yuku0001device'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        'yuku_settings',
        sa.Column('key', sa.String(length=128), nullable=False),
        sa.Column('value', sa.String(length=4096), nullable=True),
        sa.PrimaryKeyConstraint('key'),
    )


def downgrade() -> None:
    op.drop_table('yuku_settings')

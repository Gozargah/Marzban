"""add path to hosts

Revision ID: 470465472326
Revises: e56f1c781e46
Create Date: 2023-12-15 05:46:43.493605

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = '470465472326'
down_revision = 'e56f1c781e46'
branch_labels = None
depends_on = None


def upgrade() -> None:
    with op.batch_alter_table('hosts') as batch_op:
        batch_op.add_column(sa.Column('path', sa.String(256), nullable=True))


def downgrade() -> None:
    with op.batch_alter_table('hosts') as batch_op:
        batch_op.drop_column('path')

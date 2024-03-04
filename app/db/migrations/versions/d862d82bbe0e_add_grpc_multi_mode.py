"""add grpc multi mode

Revision ID: d862d82bbe0e
Revises: 4f045f53bef8
Create Date: 2024-03-04 13:25:16.087434

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = 'd862d82bbe0e'
down_revision = '4f045f53bef8'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # ### commands auto generated by Alembic - please adjust! ###
    op.add_column('hosts', sa.Column('multi_mode', sa.Boolean(), nullable=False))
    # ### end Alembic commands ###


def downgrade() -> None:
    # ### commands auto generated by Alembic - please adjust! ###
    op.drop_column('hosts', 'multi_mode')
    # ### end Alembic commands ###

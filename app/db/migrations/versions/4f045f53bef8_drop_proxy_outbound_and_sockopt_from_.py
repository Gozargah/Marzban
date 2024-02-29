"""drop proxy_outbound and sockopt from hosts

Revision ID: 4f045f53bef8
Revises: 1ad79b97fdcf
Create Date: 2024-02-28 20:45:33.206410

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import mysql

# revision identifiers, used by Alembic.
revision = '4f045f53bef8'
down_revision = '1ad79b97fdcf'
branch_labels = None
depends_on = None


def upgrade() -> None:
		with op.batch_alter_table('hosts') as batch_op:
			batch_op.drop_column('proxy_outbound')
			batch_op.drop_column('sockopt')


def downgrade() -> None:
    op.add_column('hosts', sa.Column('sockopt', sa.JSON(), nullable=True))
    op.add_column('hosts', sa.Column('proxy_outbound', sa.JSON(), nullable=True))

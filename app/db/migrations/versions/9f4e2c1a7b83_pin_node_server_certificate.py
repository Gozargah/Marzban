"""pin node server certificate

Revision ID: 9f4e2c1a7b83
Revises: 2b231de97dc3
Create Date: 2026-08-26

"""
import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision = '9f4e2c1a7b83'
down_revision = '2b231de97dc3'
branch_labels = None
depends_on = None


def upgrade() -> None:
    with op.batch_alter_table('nodes') as batch_op:
        batch_op.add_column(sa.Column('server_cert', sa.String(length=4096), nullable=True))


def downgrade() -> None:
    with op.batch_alter_table('nodes') as batch_op:
        batch_op.drop_column('server_cert')

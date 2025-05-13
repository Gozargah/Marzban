"""rename admin users usage to used_traffic

Revision ID: d085fae205b6
Revises: 9af04c077ede
Create Date: 2025-05-10 18:13:19.235725

"""
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = 'd085fae205b6'
down_revision = '9af04c077ede'
branch_labels = None
depends_on = None


def upgrade():
    with op.batch_alter_table('admins') as batch_op:
        batch_op.alter_column('users_usage', new_column_name='used_traffic', existing_type=sa.BigInteger)

def downgrade():
    with op.batch_alter_table('admins') as batch_op:
        batch_op.alter_column('used_traffic', new_column_name='users_usage', existing_type=sa.BigInteger)

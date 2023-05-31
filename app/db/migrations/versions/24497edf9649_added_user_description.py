"""added_user_description

Revision ID: 24497edf9649
Revises: fc01b1520e72
Create Date: 2023-05-31 23:34:09.378851

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = '24497edf9649'
down_revision = 'fc01b1520e72'
branch_labels = None
depends_on = None


def upgrade() -> None:
    with op.batch_alter_table('users') as batch_op:
        batch_op.add_column(
            sa.Column('description', sa.String, server_default=""))


def downgrade() -> None:
    with op.batch_alter_table('users') as batch_op:
        batch_op.drop_column('description')

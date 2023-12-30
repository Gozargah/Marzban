"""Fix on hold

Revision ID: e56f1c781e46
Revises: 714f227201a7
Create Date: 2023-11-03 20:47:52.601783
"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = 'e56f1c781e46'
down_revision = '714f227201a7'
branch_labels = None
depends_on = None


def upgrade():
    op.add_column('users', sa.Column('on_hold_timeout', sa.DateTime))
    op.add_column('users', sa.Column('on_hold_expire_duration', sa.BigInteger(), nullable=True))
    with op.batch_alter_table('users') as batch_op:
        batch_op.drop_column('timeout')


def downgrade():
    op.add_column('users', sa.Column('timeout', sa.Integer))
    with op.batch_alter_table('users') as batch_op:
        batch_op.drop_column('on_hold_timeout')
        batch_op.drop_column('on_hold_expire_duration')

"""Add allow in secure and disable host

Revision ID: a0715c2615f0
Revises: 1cf7d159fdbb
Create Date: 2023-09-13 20:39:58.913256

"""
import sqlalchemy
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = 'a0715c2615f0'
down_revision = '1cf7d159fdbb'
branch_labels = None
depends_on = None


def upgrade() -> None:
    try:
        op.add_column('hosts', sa.Column('allowinsecure', sa.Boolean(), nullable=True))
    except sqlalchemy.exc.OperationalError:
        with op.batch_alter_table('hosts') as batch_op:
            batch_op.drop_column('allowinsecure')
        op.add_column('hosts', sa.Column('allowinsecure', sa.Boolean(), nullable=True))

    op.add_column('hosts', sa.Column('is_disabled', sa.Boolean(), nullable=True))


def downgrade() -> None:
    with op.batch_alter_table('hosts') as batch_op:
        batch_op.drop_column('is_disabled')
        batch_op.drop_column('allowinsecure')

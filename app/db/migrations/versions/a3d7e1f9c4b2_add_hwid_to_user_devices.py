"""add hwid to user devices

Revision ID: a3d7e1f9c4b2
Revises: f1c2a5e9d3b7
Create Date: 2026-07-31 13:00:00.000000

"""
import sqlalchemy as sa
from alembic import op

revision = 'a3d7e1f9c4b2'
down_revision = 'f1c2a5e9d3b7'
branch_labels = None
depends_on = None


def upgrade() -> None:
    with op.batch_alter_table('user_devices') as batch_op:
        batch_op.add_column(sa.Column('hwid', sa.String(length=128), nullable=True))
        batch_op.add_column(sa.Column('device_os', sa.String(length=64), nullable=True))
        batch_op.add_column(sa.Column('device_model', sa.String(length=128), nullable=True))
        batch_op.create_unique_constraint('uq_user_device_hwid', ['user_id', 'hwid'])


def downgrade() -> None:
    with op.batch_alter_table('user_devices') as batch_op:
        batch_op.drop_constraint('uq_user_device_hwid', type_='unique')
        batch_op.drop_column('device_model')
        batch_op.drop_column('device_os')
        batch_op.drop_column('hwid')

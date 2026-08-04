"""add node relay fields

Revision ID: b8f4c1a7e2d9
Revises: a3d7e1f9c4b2
Create Date: 2026-08-04 00:00:00.000000

"""
import sqlalchemy as sa
from alembic import op

revision = 'b8f4c1a7e2d9'
down_revision = 'a3d7e1f9c4b2'
branch_labels = None
depends_on = None


def upgrade() -> None:
    with op.batch_alter_table('nodes') as batch_op:
        batch_op.add_column(sa.Column('relay_listen_port', sa.Integer(), nullable=True))
        batch_op.add_column(sa.Column('relay_target_address', sa.String(length=256), nullable=True))
        batch_op.add_column(sa.Column('relay_target_port', sa.Integer(), nullable=True))


def downgrade() -> None:
    with op.batch_alter_table('nodes') as batch_op:
        batch_op.drop_column('relay_target_port')
        batch_op.drop_column('relay_target_address')
        batch_op.drop_column('relay_listen_port')

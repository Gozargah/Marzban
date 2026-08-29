"""network profiles

Revision ID: c7a1b93e4f28
Revises: 9f4e2c1a7b83
Create Date: 2026-08-27

"""
import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision = 'c7a1b93e4f28'
down_revision = '9f4e2c1a7b83'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        'network_profiles',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('name', sa.String(length=64), nullable=False),
        sa.Column('description', sa.String(length=512), nullable=True),
        sa.Column('settings', sa.JSON(), nullable=False),
        sa.Column('builtin', sa.Boolean(), server_default='0', nullable=False),
        sa.Column('created_at', sa.DateTime(), nullable=True),
        sa.Column('updated_at', sa.DateTime(), nullable=True),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index(op.f('ix_network_profiles_name'), 'network_profiles', ['name'], unique=True)


def downgrade() -> None:
    op.drop_index(op.f('ix_network_profiles_name'), table_name='network_profiles')
    op.drop_table('network_profiles')

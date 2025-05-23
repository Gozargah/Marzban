"""Token blacklist

Revision ID: token_blacklist_1
Revises: 
Create Date: 2023-05-23 00:00:00.000000

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = 'token_blacklist_1'
down_revision = None
branch_labels = None
depends_on = None


def upgrade():
    op.create_table('token_blacklist',
        sa.Column('token_id', sa.String(length=255), nullable=False),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.Column('expires_at', sa.DateTime(), nullable=True),
        sa.PrimaryKeyConstraint('token_id')
    )
    op.create_index(op.f('ix_token_blacklist_token_id'), 'token_blacklist', ['token_id'], unique=False)


def downgrade():
    op.drop_index(op.f('ix_token_blacklist_token_id'), table_name='token_blacklist')
    op.drop_table('token_blacklist') 
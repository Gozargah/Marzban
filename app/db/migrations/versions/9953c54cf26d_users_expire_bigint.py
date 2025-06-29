"""use BigInteger for expire columns

Revision ID: 9953c54cf26d
Revises: 2b231de97dc3
Create Date: 2025-06-30 00:00:00.000000
"""
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = '9953c54cf26d'
down_revision = '2b231de97dc3'
branch_labels = None
depends_on = None


def upgrade() -> None:
    with op.batch_alter_table('users') as batch_op:
        batch_op.alter_column('expire', type_=sa.BigInteger(), existing_type=sa.Integer(), nullable=True)
    with op.batch_alter_table('next_plans') as batch_op:
        batch_op.alter_column('expire', type_=sa.BigInteger(), existing_type=sa.Integer(), nullable=True)


def downgrade() -> None:
    with op.batch_alter_table('users') as batch_op:
        batch_op.alter_column('expire', type_=sa.Integer(), existing_type=sa.BigInteger(), nullable=True)
    with op.batch_alter_table('next_plans') as batch_op:
        batch_op.alter_column('expire', type_=sa.Integer(), existing_type=sa.BigInteger(), nullable=True)

"""increase length of the host and sni columns

Revision ID: e7b869e999b4
Revises: be0c5f840473
Create Date: 2024-12-12 15:41:55.487859

"""
import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision = 'e7b869e999b4'
down_revision = 'be0c5f840473'
branch_labels = None
depends_on = None


def upgrade():
    # Increase the length of 'sni' and 'host' columns to 1000
    bind = op.get_bind()
    if bind.engine.name == 'sqlite':
        with op.batch_alter_table('hosts') as batch_op:
            batch_op.alter_column('host',
                                  existing_type=sa.String(length=256),
                                  type_=sa.String(length=1000),
                                  nullable=True)
            batch_op.alter_column('sni',
                                  existing_type=sa.String(length=256),
                                  type_=sa.String(length=1000),
                                  nullable=True)

    else:
        op.alter_column('hosts', 'sni',
                        existing_type=sa.String(length=256),  # old length or assumed type
                        type_=sa.String(length=1000),        # new length
                        existing_nullable=True)             # nullable or not

        op.alter_column('hosts', 'host',
                        existing_type=sa.String(length=256),  # old length or assumed type
                        type_=sa.String(length=1000),        # new length
                        existing_nullable=True)


def downgrade():
    # Revert the column lengths back to their original size
    bind = op.get_bind()
    if bind.engine.name == 'sqlite':
        with op.batch_alter_table('hosts') as batch_op:
            batch_op.alter_column('host',
                                  existing_type=sa.String(length=1000),
                                  type_=sa.String(length=256),
                                  nullable=True)
            batch_op.alter_column('sni',
                                  existing_type=sa.String(length=1000),
                                  type_=sa.String(length=256),
                                  nullable=True)

    op.alter_column('hosts', 'sni',
                    existing_type=sa.String(length=1000),
                    type_=sa.String(length=256),
                    existing_nullable=True)

    op.alter_column('hosts', 'host',
                    existing_type=sa.String(length=1000),
                    type_=sa.String(length=256),
                    existing_nullable=True)

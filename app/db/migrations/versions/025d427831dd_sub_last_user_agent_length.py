"""sub_last_user_agent length

Revision ID: 025d427831dd
Revises: a6e3fff39291
Create Date: 2023-08-22 00:50:25.575609

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = '025d427831dd'
down_revision = 'a6e3fff39291'
branch_labels = None
depends_on = None


def upgrade() -> None:
    bind = op.get_bind()

    if bind.engine.name == 'mysql':
        op.alter_column('users', 'sub_last_user_agent',
                        existing_type=sa.String(length=512),
                        nullable=True)


def downgrade() -> None:
    bind = op.get_bind()

    if bind.engine.name == 'mysql':
        op.alter_column('users', 'sub_last_user_agent',
                        existing_type=sa.String(length=64),
                        nullable=True)

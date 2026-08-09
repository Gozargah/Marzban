"""add status to user_devices (YUKU): active / revoked soft-state

Revision ID: yuku0003devstatus
Revises: yuku0002settings
Create Date: 2026-06-15

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = 'yuku0003devstatus'
down_revision = 'yuku0002settings'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # active = counts toward the limit; revoked = soft-banned, kept for history
    with op.batch_alter_table('user_devices') as batch_op:
        batch_op.add_column(
            sa.Column('status', sa.String(length=16), nullable=False,
                      server_default='active')
        )


def downgrade() -> None:
    with op.batch_alter_table('user_devices') as batch_op:
        batch_op.drop_column('status')

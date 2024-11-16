"""add_telegram_id_to_admin

Revision ID: 5575fe410515
Revises: 4aa420578f51
Create Date: 2024-02-01 22:30:47.515512

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = '5575fe410515'
down_revision = '4aa420578f51'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # ### commands auto generated by Alembic - please adjust! ###
    op.add_column('admins', sa.Column('telegram_id', sa.BigInteger(), nullable=True))
    op.add_column('admins', sa.Column('discord_webhook', sa.String(length=1024), nullable=True))
    # ### end Alembic commands ###


def downgrade() -> None:
    # ### commands auto generated by Alembic - please adjust! ###
    op.drop_column('admins', 'discord_webhook')
    op.drop_column('admins', 'telegram_id')
    # ### end Alembic commands ###

"""sub_updated_at and sub_last_user_agent

Revision ID: 015cf1dc6eca
Revises: c47250b790eb
Create Date: 2023-08-08 18:42:07.829202

"""

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = "015cf1dc6eca"
down_revision = "c47250b790eb"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # ### commands auto generated by Alembic - please adjust! ###
    op.add_column("users", sa.Column("sub_updated_at", sa.DateTime(), nullable=True))
    op.add_column("users", sa.Column("sub_last_user_agent", sa.String(length=64), nullable=True))
    # ### end Alembic commands ###


def downgrade() -> None:
    # ### commands auto generated by Alembic - please adjust! ###
    op.drop_column("users", "sub_last_user_agent")
    op.drop_column("users", "sub_updated_at")
    # ### end Alembic commands ###

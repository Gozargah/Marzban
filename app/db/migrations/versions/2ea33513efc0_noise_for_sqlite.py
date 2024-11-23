"""noise for sqlite

Revision ID: 2ea33513efc0
Revises: a9cfd5611a82
Create Date: 2024-10-11 15:36:32.096594

"""

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = "2ea33513efc0"
down_revision = "a9cfd5611a82"
branch_labels = None
depends_on = None


def upgrade() -> None:
    bind = op.get_bind()

    if bind.engine.name == "sqlite":
        with op.batch_alter_table("hosts") as batch_op:
            batch_op.alter_column(
                "noise_setting", existing_type=sa.String(length=2000), nullable=True
            )


def downgrade() -> None:
    # ### commands auto generated by Alembic - please adjust! ###
    pass
    # ### end Alembic commands ###

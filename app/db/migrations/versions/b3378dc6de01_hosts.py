"""hosts

Revision ID: b3378dc6de01
Revises: e91236993f1a
Create Date: 2023-02-14 18:22:26.791353

"""

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = "b3378dc6de01"
down_revision = "e91236993f1a"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # ### commands auto generated by Alembic - please adjust! ###
    op.create_table(
        "hosts",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("remark", sa.String(256), nullable=False),
        sa.Column("address", sa.String(256), nullable=False),
        sa.Column("port", sa.Integer(), nullable=True),
        sa.Column("inbound_tag", sa.String(256), nullable=False),
        sa.ForeignKeyConstraint(
            ["inbound_tag"],
            ["inbounds.tag"],
        ),
        sa.PrimaryKeyConstraint("id"),
    )
    # ### end Alembic commands ###


def downgrade() -> None:
    # ### commands auto generated by Alembic - please adjust! ###
    op.drop_table("hosts")
    # ### end Alembic commands ###

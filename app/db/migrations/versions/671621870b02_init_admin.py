"""init admin

Revision ID: 671621870b02
Revises: 8e849e06f131
Create Date: 2023-01-13 18:57:40.199730

"""

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = "671621870b02"
down_revision = "8e849e06f131"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # ### commands auto generated by Alembic - please adjust! ###
    op.create_table(
        "admins",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("username", sa.String(34), nullable=True),
        sa.Column("hashed_password", sa.String(128), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=True),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_admins_id"), "admins", ["id"], unique=False)
    op.create_index(op.f("ix_admins_username"), "admins", ["username"], unique=True)
    with op.batch_alter_table("users") as batch_op:
        batch_op.add_column(sa.Column("admin_id", sa.Integer(), nullable=True))
        batch_op.create_foreign_key(
            "fk_users_admin_id_admins", "admins", ["admin_id"], ["id"]
        )
    # ### end Alembic commands ###


def downgrade() -> None:
    # ### commands auto generated by Alembic - please adjust! ###
    with op.batch_alter_table("users") as batch_op:
        batch_op.drop_column("admin_id")
        batch_op.drop_constraint("fk_users_admin_id_admins", type_="foreignkey")
    op.drop_index(op.f("ix_admins_username"), table_name="admins")
    op.drop_index(op.f("ix_admins_id"), table_name="admins")
    op.drop_table("admins")
    # ### end Alembic commands ###

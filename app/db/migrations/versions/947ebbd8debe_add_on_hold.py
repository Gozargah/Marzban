"""Add on hold

Revision ID: 947ebbd8debe
Revises: 08b381fc1bc7
Create Date: 2023-10-08 06:37:10.027798

"""

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = "947ebbd8debe"
down_revision = "08b381fc1bc7"
branch_labels = None
depends_on = None

# Describing of enum
enum_name = "status"
temp_enum_name = f"temp_{enum_name}"
old_values = ("active", "limited", "expired", "disabled")
new_values = ("on_hold", *old_values)
# on downgrade convert [0] to [1]
downgrade_to = ("on_hold", "active")
old_type = sa.Enum(*old_values, name=enum_name)
new_type = sa.Enum(*new_values, name=enum_name)
temp_type = sa.Enum(*new_values, name=temp_enum_name)


# Describing of table
table_name = "users"
column_name = "status"
temp_table = sa.sql.table(table_name, sa.Column(column_name, new_type, nullable=False))


def upgrade():
    # temp type to use instead of old one
    temp_type.create(op.get_bind(), checkfirst=False)

    # changing of column type from old enum to new one.
    # SQLite will create temp table for this
    with op.batch_alter_table(table_name) as batch_op:
        batch_op.alter_column(
            column_name,
            existing_type=old_type,
            type_=temp_type,
            existing_nullable=False,
            postgresql_using=f"{column_name}::text::{temp_enum_name}",
        )

    # remove old enum, create new enum
    old_type.drop(op.get_bind(), checkfirst=False)
    new_type.create(op.get_bind(), checkfirst=False)

    # changing of column type from temp enum to new one.
    # SQLite will create temp table for this
    with op.batch_alter_table(table_name) as batch_op:
        batch_op.alter_column(
            column_name,
            existing_type=temp_type,
            type_=new_type,
            existing_nullable=False,
            postgresql_using=f"{column_name}::text::{enum_name}",
        )

    # remove temp enum
    temp_type.drop(op.get_bind(), checkfirst=False)

    op.add_column("users", sa.Column("timeout", sa.Integer(), nullable=True))
    op.add_column("users", sa.Column("edit_at", sa.DateTime(), nullable=True))


def downgrade():
    # old enum don't have new value anymore.
    # before downgrading from new enum to old one,
    # we should replace new value from new enum with
    # somewhat of old values from old enum
    op.execute(
        temp_table.update()
        .where(temp_table.c.status == downgrade_to[0])
        .values(status=downgrade_to[1])
    )

    temp_type.create(op.get_bind(), checkfirst=False)

    with op.batch_alter_table(table_name) as batch_op:
        batch_op.alter_column(
            column_name,
            existing_type=new_type,
            type_=temp_type,
            existing_nullable=False,
            postgresql_using=f"{column_name}::text::{temp_enum_name}",
        )

    new_type.drop(op.get_bind(), checkfirst=False)
    old_type.create(op.get_bind(), checkfirst=False)

    with op.batch_alter_table(table_name) as batch_op:
        batch_op.alter_column(
            column_name,
            existing_type=temp_type,
            type_=old_type,
            existing_nullable=False,
            postgresql_using=f"{column_name}::text::{enum_name}",
        )

    temp_type.drop(op.get_bind(), checkfirst=False)

    op.drop_column("users", "edit_at")
    op.drop_column("users", "timeout")

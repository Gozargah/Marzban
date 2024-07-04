"""add h3 to alpn enum

Revision ID: 305943d779c4
Revises: 31f92220c0d0
Create Date: 2024-07-03 19:27:15.282711

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = '305943d779c4'
down_revision = '31f92220c0d0'
branch_labels = None
depends_on = None


# Describing of enum
enum_name = "alpn"
temp_enum_name = f"temp_{enum_name}"
old_values = ("none", "h2", "http/1.1", "h2,http/1.1")
new_values = ("h3", "h3,h2", "h3,h2,http/1.1", *old_values)
# on downgrade
downgrade_from = ("h3", "h3,h2", "h3,h2,http/1.1", "")
downgrade_to = "none"
old_type = sa.Enum(*old_values, name=enum_name)
new_type = sa.Enum(*new_values, name=enum_name)
temp_type = sa.Enum(*new_values, name=temp_enum_name)


# Describing of table
table_name = "hosts"
column_name = "alpn"
temp_table = sa.sql.table(
    table_name,
    sa.Column(
        column_name,
        new_type,
        nullable=False
    )
)


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
            postgresql_using=f"{column_name}::text::{temp_enum_name}"
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
            postgresql_using=f"{column_name}::text::{enum_name}"
        )

    # remove temp enum
    temp_type.drop(op.get_bind(), checkfirst=False)


def downgrade():
    # old enum don't have new value anymore.
    # before downgrading from new enum to old one,
    # we should replace new value from new enum with
    # somewhat of old values from old enum
    update_query = (
        temp_table
        .update()
        .where(temp_table.c.alpn.in_(downgrade_from))
        .values(alpn=downgrade_to)
    )
    op.execute(update_query)

    temp_type.create(op.get_bind(), checkfirst=False)

    with op.batch_alter_table(table_name) as batch_op:
        batch_op.alter_column(
            column_name,
            existing_type=new_type,
            type_=temp_type,
            existing_nullable=False,
            postgresql_using=f"{column_name}::text::{temp_enum_name}"
        )

    new_type.drop(op.get_bind(), checkfirst=False)
    old_type.create(op.get_bind(), checkfirst=False)

    with op.batch_alter_table(table_name) as batch_op:
        batch_op.alter_column(
            column_name,
            existing_type=temp_type,
            type_=old_type,
            existing_nullable=False,
            postgresql_using=f"{column_name}::text::{enum_name}"
        )

    temp_type.drop(op.get_bind(), checkfirst=False)

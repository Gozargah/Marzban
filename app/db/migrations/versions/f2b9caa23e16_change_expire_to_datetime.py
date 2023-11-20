"""Change expire to DateTime

Revision ID: f2b9caa23e16
Revises: e56f1c781e46
Create Date: 2023-11-06 18:34:31.935829

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.sql import text
from datetime import datetime


# revision identifiers, used by Alembic.
revision = 'f2b9caa23e16'
down_revision = 'e56f1c781e46'
branch_labels = None
depends_on = None


def upgrade():
    connection = op.get_bind()

    # Add temporary columns with the DateTime data type
    op.add_column('users', sa.Column('expire_temp', sa.DateTime, nullable=True))

    rows = connection.execute("SELECT id, expire FROM users").fetchall()

    for row in rows:
        expire_timestamp = row['expire']

        # Calculate the new datetime values
        expire_datetime = datetime.utcfromtimestamp(expire_timestamp) if expire_timestamp else None

        # Update the temporary columns with the calculated datetime values
        connection.execute(
            text("""
                UPDATE users 
                SET expire_temp = :expire,
                WHERE id = :id
                """
            ).params(
                expire=expire_datetime,
                id=row['id']
            )
        )

    op.drop_column('users', 'expire')
    op.alter_column('users', 'expire_temp', new_column_name='expire', existing_type=sa.DateTime)


def downgrade():
    connection = op.get_bind()

    # Add temporary columns with the DateTime data type
    op.add_column('users', sa.Column('expire_temp', sa.BigInteger, nullable=True))

    rows = connection.execute("SELECT id, expire FROM users").fetchall()

    for row in rows:
        expire_datetime = row['expire']

        # Calculate the new datetime values
        expire_timestamp = datetime.timestamp(expire_datetime) if expire_datetime is not None else None

        # Update the temporary columns with the calculated values
        connection.execute(
            text("""
                UPDATE users 
                SET expire_temp = :expire
                WHERE id = :id
                """
            ).params(
                expire=expire_timestamp,
                id=row['id']
            )
        )

    op.drop_column('users', 'expire')
    op.alter_column('users', 'expire_temp', new_column_name='expire', existing_type=sa.BigInteger)
"""Fix on hold
Revision ID: e56f1c781e46
Revises: 714f227201a7
Create Date: 2023-11-03 20:47:52.601783
"""
from datetime import timedelta

from alembic import op
import sqlalchemy as sa
from sqlalchemy.sql import text


# revision identifiers, used by Alembic.
revision = 'e56f1c781e46'
down_revision = '714f227201a7'
branch_labels = None
depends_on = None


def upgrade():
    # Add a new column with the DateTime data type for 'on_hold_timeout'
    op.add_column('users', sa.Column('on_hold_timeout', sa.DateTime))

    connection = op.get_bind()

    # Fetch all rows from the 'users' table
    rows = connection.execute("SELECT id, timeout, edit_at, created_at FROM users").fetchall()

    for row in rows:
        timeout = row['timeout']
        edit_at = row['edit_at']
        created_at = row['created_at']

        # Calculate the 'on_hold_timeout' value based on your logic
        if edit_at is None:
            on_hold_timeout = created_at + timedelta(seconds=timeout)
        else:
            on_hold_timeout = edit_at + timedelta(seconds=timeout)

        # Update the 'on_hold_timeout' for the specific row
        connection.execute(
            text("UPDATE users SET on_hold_timeout = :on_hold_timeout WHERE id = :id").params(
                on_hold_timeout=on_hold_timeout,
                id=row['id']
            )
        )

    # Remove the old 'timeout' column
    op.drop_column('users', 'timeout')

    # Add the new 'on_hold_expire_duration' column with the BigInteger data type
    op.add_column('users', sa.Column('on_hold_expire_duration', sa.BigInteger(), nullable=True))

def downgrade():
    # Add the 'timeout' column with the Integer data type
    op.add_column('users', sa.Column('timeout', sa.Integer))

    connection = op.get_bind()

    # Fetch all rows from the 'users' table
    rows = connection.execute("SELECT id, on_hold_timeout, edit_at, created_at FROM users").fetchall()

    for row in rows:
        on_hold_timeout = row['on_hold_timeout']
        edit_at = row['edit_at']
        created_at = row['created_at']

        # Calculate the 'timeout' value based on your logic
        if edit_at is None:
            timeout = (on_hold_timeout - created_at).total_seconds()
        else:
            timeout = (on_hold_timeout - edit_at).total_seconds()

        # Update the 'timeout' for the specific row
        connection.execute(
            text("UPDATE users SET timeout = :timeout WHERE id = :id").params(
                timeout=timeout,
                id=row['id']
            )
        )

    # Remove the new 'on_hold_timeout' and 'on_hold_expire_duration' columns
    op.drop_column('users', 'on_hold_timeout')
    op.drop_column('users', 'on_hold_expire_duration')
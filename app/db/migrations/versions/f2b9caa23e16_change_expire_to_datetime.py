"""Change expire to DateTime
Revision ID: f2b9caa23e16
Revises: 4eb0a0eb835f
Create Date: 2024-12-11 13:34:31.935829
"""
from datetime import datetime, timezone

import sqlalchemy as sa
from alembic import op
from sqlalchemy.orm import Session

# revision identifiers, used by Alembic.
revision = 'f2b9caa23e16'
down_revision = '4eb0a0eb835f'
branch_labels = None
depends_on = None


def upgrade():
    bind = op.get_bind()
    session = Session(bind=bind)

    def expire_to_datetime(table: sa.Table):
        for row in session.query(table.c.id, table.c.expire).all():
            expire_timestamp = row.expire
            expire_datetime = datetime.fromtimestamp(expire_timestamp, tz=timezone.utc) if expire_timestamp else None

            session.execute(
                table.update().where(table.c.id == row.id).values(expire_temp=expire_datetime)
            )

    # Add temporary columns with the DateTime data type
    op.add_column('users', sa.Column('expire_temp', sa.DateTime, nullable=True))

    with op.batch_alter_table('users') as batch_op:
        users_table = sa.Table('users', sa.MetaData(), autoload_with=bind)
        expire_to_datetime(users_table)

        batch_op.drop_column('expire')
        batch_op.alter_column('expire_temp', new_column_name='expire', existing_type=sa.DateTime)

    session.commit()


def downgrade():
    bind = op.get_bind()
    session = Session(bind=bind)

    def expire_to_integer(table: sa.Table):
        for row in session.query(table.c.id, table.c.expire).all():
            expire_datetime = row.expire
            expire_timestamp = int(expire_datetime.timestamp()) if expire_datetime else None

            # Update the temporary column
            session.execute(
                table.update().where(table.c.id == row.id).values(expire_temp=expire_timestamp)
            )

    op.add_column('users', sa.Column('expire_temp', sa.Integer, nullable=True))

    # Add temporary columns with the BigInteger data type
    with op.batch_alter_table('users') as batch_op:
        # Fetch all rows and update the temporary column
        users_table = sa.Table('users', sa.MetaData(), autoload_with=bind)
        expire_to_integer(users_table)

        batch_op.drop_column('expire')
        batch_op.alter_column('expire_temp', new_column_name='expire', existing_type=sa.Integer)

    session.commit()

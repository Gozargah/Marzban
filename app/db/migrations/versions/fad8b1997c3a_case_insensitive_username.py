"""case insensitive username

Revision ID: fad8b1997c3a
Revises: 5b84d88804a1
Create Date: 2023-03-17 22:46:32.833004

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = 'fad8b1997c3a'
down_revision = '5b84d88804a1'
branch_labels = None
depends_on = None


def upgrade() -> None:
    bind = op.get_bind()

    if bind.engine.name == 'mysql':
        pass  # By default, MySQL is case-insensitive.

    if bind.engine.name == 'sqlite':
        op.drop_index('ix_users_username', table_name='users')
        while True:
            q = bind.execute(
                'SELECT username, COUNT(*) FROM users GROUP BY username COLLATE NOCASE HAVING COUNT(*) > 1;'
            )
            if not (r := q.fetchall()):
                break
            for username, c in r:
                bind.execute(f"UPDATE users SET username = '{username}_{c}' WHERE username = '{username}';")

        with op.batch_alter_table('users') as batch_op:
            batch_op.alter_column('username', type_=sa.String(length=34, collation='NOCASE'))
        op.create_index(op.f('ix_users_username'), 'users', ['username'], unique=True)


def downgrade() -> None:
    bind = op.get_bind()

    if bind.engine.name == 'mysql':
        pass  # By default, MySQL is case-insensitive.

    if bind.engine.name == 'sqlite':
        with op.batch_alter_table('users') as batch_op:
            batch_op.alter_column('username', type_=sa.String(length=34))
        op.drop_index('ix_users_username', table_name='users')
        op.create_index(op.f('ix_users_username'), 'users', ['username'], unique=True)

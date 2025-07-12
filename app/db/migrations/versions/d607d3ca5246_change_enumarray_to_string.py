"""Change EnumArray to String

Revision ID: d607d3ca5246
Revises: 04a5ec93e9a5
Create Date: 2025-07-11 16:21:16.858208

"""
from alembic import op
import sqlalchemy as sa
import json
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision = 'd607d3ca5246'
down_revision = '04a5ec93e9a5'
branch_labels = None
depends_on = None

user_status = sa.Enum('active', 'disabled', 'limited', 'expired', 'on_hold', name='userstatus')

def upgrade() -> None:
    bind = op.get_bind()
    is_postgres = bind.engine.name == 'postgresql'

    op.add_column('hosts', sa.Column('status_new', sa.String(length=60), nullable=True, server_default=""))

    connection = op.get_bind()
    if is_postgres:
        hosts_table = sa.Table('hosts', sa.MetaData(), sa.Column('id', sa.Integer, primary_key=True), sa.Column('status', postgresql.ARRAY(user_status)), sa.Column('status_new', sa.String(60)))
    else:
        hosts_table = sa.Table('hosts', sa.MetaData(), sa.Column('id', sa.Integer, primary_key=True), sa.Column('status', sa.JSON), sa.Column('status_new', sa.String(60)))


    for host in connection.execute(sa.select(hosts_table.c.id, hosts_table.c.status)):
        if host.status:
            status_list = host.status
            if not is_postgres and isinstance(status_list, str):
                status_list = json.loads(status_list)
            new_status = ",".join([s.strip('"') for s in status_list])
            connection.execute(
                hosts_table.update().where(hosts_table.c.id == host.id).values(status_new=new_status)
            )

    with op.batch_alter_table('hosts') as batch_op:
        batch_op.drop_column('status')
        batch_op.alter_column('status_new', new_column_name='status', existing_type=sa.String(60))


def downgrade() -> None:
    bind = op.get_bind()
    is_postgres = bind.engine.name == 'postgresql'

    if is_postgres:
        op.add_column('hosts', sa.Column('status_old', postgresql.ARRAY(user_status), nullable=True, server_default="{}"))
    else:
        op.add_column('hosts', sa.Column('status_old', sa.JSON(), nullable=True, server_default=sa.text("'[]'")))

    connection = op.get_bind()
    if is_postgres:
        hosts_table = sa.Table('hosts', sa.MetaData(), sa.Column('id', sa.Integer, primary_key=True), sa.Column('status', sa.String(60)), sa.Column('status_old', postgresql.ARRAY(user_status)))
    else:
        hosts_table = sa.Table('hosts', sa.MetaData(), sa.Column('id', sa.Integer, primary_key=True), sa.Column('status', sa.String(60)), sa.Column('status_old', sa.JSON))

    for host in connection.execute(sa.select(hosts_table.c.id, hosts_table.c.status)):
        if host.status:
            cleaned_list = [s.strip('"') for s in host.status.split(',')]
            if is_postgres:
                new_status = cleaned_list
            else:
                new_status = json.dumps(cleaned_list)
            connection.execute(
                hosts_table.update().where(hosts_table.c.id == host.id).values(status_old=new_status)
            )

    with op.batch_alter_table('hosts') as batch_op:
        batch_op.drop_column('status')
        if is_postgres:
            batch_op.alter_column('status_old', new_column_name='status', existing_type=postgresql.ARRAY(user_status))
        else:
            batch_op.alter_column('status_old', new_column_name='status', existing_type=sa.JSON)

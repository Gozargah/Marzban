"""Change EnumArray to String

Revision ID: d607d3ca5246
Revises: 04a5ec93e9a5
Create Date: 2025-07-11 16:21:16.858208

"""
from alembic import op
import sqlalchemy as sa
import json

# revision identifiers, used by Alembic.
revision = 'd607d3ca5246'
down_revision = '04a5ec93e9a5'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column('hosts', sa.Column('status_new', sa.String(length=255), nullable=True, server_default=""))

    connection = op.get_bind()
    hosts_table = sa.Table('hosts', sa.MetaData(), sa.Column('id', sa.Integer, primary_key=True), sa.Column('status', sa.JSON), sa.Column('status_new', sa.String(255)))

    for host in connection.execute(sa.select(hosts_table.c.id, hosts_table.c.status)):
        if host.status:
            status_list = host.status
            if isinstance(status_list, str):
                status_list = json.loads(status_list)
            new_status = ",".join([s.strip('"') for s in status_list])
            connection.execute(
                hosts_table.update().where(hosts_table.c.id == host.id).values(status_new=new_status)
            )

    with op.batch_alter_table('hosts') as batch_op:
        batch_op.drop_column('status')
        batch_op.alter_column('status_new', new_column_name='status', existing_type=sa.String(255))


def downgrade() -> None:
    op.add_column('hosts', sa.Column('status_old', sa.JSON(), nullable=True, server_default=sa.text("'[]'")))

    connection = op.get_bind()
    hosts_table = sa.Table('hosts', sa.MetaData(), sa.Column('id', sa.Integer, primary_key=True), sa.Column('status', sa.String(255)), sa.Column('status_old', sa.JSON))

    for host in connection.execute(sa.select(hosts_table.c.id, hosts_table.c.status)):
        if host.status:
            cleaned_list = [s.strip('"') for s in host.status.split(',')]
            new_status = json.dumps(cleaned_list)
            connection.execute(
                hosts_table.update().where(hosts_table.c.id == host.id).values(status_old=new_status)
            )

    with op.batch_alter_table('hosts') as batch_op:
        batch_op.drop_column('status')
        batch_op.alter_column('status_old', new_column_name='status', existing_type=sa.JSON)

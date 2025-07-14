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
        # Use raw SQL to avoid SQLAlchemy's array parsing issues
        result = connection.execute(sa.text("SELECT id, status FROM hosts"))
        for row in result:
            host_id, status_value = row
            if status_value:
                try:
                    # Handle different possible formats
                    if isinstance(status_value, list):
                        # Already a list
                        status_list = status_value
                    elif isinstance(status_value, str):
                        # Parse PostgreSQL array format like '{active,disabled}'
                        if status_value.startswith('{') and status_value.endswith('}'):
                            # Remove braces and split
                            status_list = status_value[1:-1].split(',')
                        else:
                            # Fallback for other string formats
                            status_list = [status_value]
                    else:
                        # Skip invalid data
                        continue
                    
                    # Clean and join
                    new_status = ",".join([s.strip('"').strip() for s in status_list if s.strip()])
                    connection.execute(
                        sa.text("UPDATE hosts SET status_new = :status WHERE id = :host_id"),
                        {"status": new_status, "host_id": host_id}
                    )
                except Exception as e:
                    print(f"Warning: Failed to process status for host {host_id}: {e}")
                    continue
    else:
        hosts_table = sa.Table('hosts', sa.MetaData(), 
                              sa.Column('id', sa.Integer, primary_key=True), 
                              sa.Column('status', sa.JSON), 
                              sa.Column('status_new', sa.String(60)))
        
        for host in connection.execute(sa.select(hosts_table.c.id, hosts_table.c.status)):
            if host.status:
                try:
                    status_list = host.status
                    if isinstance(status_list, str):
                        status_list = json.loads(status_list)
                    new_status = ",".join([s.strip('"') for s in status_list])
                    connection.execute(
                        hosts_table.update().where(hosts_table.c.id == host.id).values(status_new=new_status)
                    )
                except Exception as e:
                    print(f"Warning: Failed to process status for host {host.id}: {e}")
                    continue
    
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
        # Use raw SQL for PostgreSQL to avoid type issues
        result = connection.execute(sa.text("SELECT id, status FROM hosts"))
        for row in result:
            host_id, status_value = row
            if status_value:
                try:
                    # Split comma-separated string and clean values
                    cleaned_list = [s.strip().strip('"') for s in status_value.split(',') if s.strip()]
                    if cleaned_list:
                        # Format as PostgreSQL array literal
                        array_literal = "{" + ",".join(cleaned_list) + "}"
                        # Use string substitution instead of parameter binding for casting
                        connection.execute(
                            sa.text(f"UPDATE hosts SET status_old = '{array_literal}'::userstatus[] WHERE id = {host_id}")
                        )
                except Exception as e:
                    print(f"Warning: Failed to process status for host {host_id}: {e}")
                    continue
    else:
        hosts_table = sa.Table('hosts', sa.MetaData(), 
                              sa.Column('id', sa.Integer, primary_key=True), 
                              sa.Column('status', sa.String(60)), 
                              sa.Column('status_old', sa.JSON))
        
        for host in connection.execute(sa.select(hosts_table.c.id, hosts_table.c.status)):
            if host.status:
                try:
                    cleaned_list = [s.strip('"') for s in host.status.split(',')]
                    new_status = json.dumps(cleaned_list)
                    connection.execute(
                        hosts_table.update().where(hosts_table.c.id == host.id).values(status_old=new_status)
                    )
                except Exception as e:
                    print(f"Warning: Failed to process status for host {host.id}: {e}")
                    continue
    
    with op.batch_alter_table('hosts') as batch_op:
        batch_op.drop_column('status')
        if is_postgres:
            batch_op.alter_column('status_old', new_column_name='status', existing_type=postgresql.ARRAY(user_status))
        else:
            batch_op.alter_column('status_old', new_column_name='status', existing_type=sa.JSON)
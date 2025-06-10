"""round float values

Revision ID: 3c466ce2ab63
Revises: fbfc49f01004
Create Date: 2025-06-09 10:45:51.691719

"""
from alembic import op
from sqlalchemy import MetaData, Table, func, update


# revision identifiers, used by Alembic.
revision = '3c466ce2ab63'
down_revision = 'fbfc49f01004'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Get connection and metadata
    connection = op.get_bind()
    metadata = MetaData()
    
    # Reflect tables
    admins = Table('admins', metadata, autoload_with=connection)
    node_user_usages = Table('node_user_usages', metadata, autoload_with=connection)
    user_usage_logs = Table('user_usage_logs', metadata, autoload_with=connection)
    users = Table('users', metadata, autoload_with=connection)
    
    # Update admins table - truncate used_traffic column (remove decimal part)
    connection.execute(
        update(admins).values(
            used_traffic=func.floor(admins.c.used_traffic)
        )
    )
    
    # Update node_user_usages table - truncate used_traffic column (remove decimal part)
    connection.execute(
        update(node_user_usages).values(
            used_traffic=func.floor(node_user_usages.c.used_traffic)
        )
    )
    
    # Update user_usage_logs table - truncate used_traffic_at_reset column (remove decimal part)
    connection.execute(
        update(user_usage_logs).values(
            used_traffic_at_reset=func.floor(user_usage_logs.c.used_traffic_at_reset)
        )
    )
    
    # Update users table - truncate used_traffic column (remove decimal part)
    connection.execute(
        update(users).values(
            used_traffic=func.floor(users.c.used_traffic)
        )
    )


def downgrade() -> None:
    # No downgrade needed as truncating decimals is irreversible
    pass

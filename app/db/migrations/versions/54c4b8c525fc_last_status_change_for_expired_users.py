"""last_status_change_for_expired_users

Revision ID: 54c4b8c525fc
Revises: 2313cdc30da3
Create Date: 2024-07-25 11:15:51.776880

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = '54c4b8c525fc'
down_revision = '2313cdc30da3'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # ### commands auto generated by Alembic - please adjust! ###
    bind = op.get_bind()
    if bind.engine.name == "mysql":
        op.execute(sa.sql.text(
            "UPDATE users SET last_status_change=FROM_UNIXTIME(expire) WHERE status='expired' AND expire is not NULL"))
    else:
        op.execute(sa.sql.text(
            "UPDATE users SET last_status_change=DATETIME(expire, 'unixepoch') WHERE status='expired' AND expire is not NULL"))
        # ### end Alembic commands ###

        def downgrade() -> None:
            # ### commands auto generated by Alembic - please adjust! ###
            op.execute(sa.sql.text(
                "UPDATE users SET last_status_change=CURRENT_TIMESTAMP WHERE status='expired' AND expire is not NULL"))
            # ### end Alembic commands ###

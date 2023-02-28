"""add host and sni columns to hosts table

Revision ID: b15eba6e5867
Revises: ece13c4c6f65
Create Date: 2023-02-28 18:34:19.100255

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = "b15eba6e5867"
down_revision = "ece13c4c6f65"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("hosts", sa.Column("sni", sa.String(), nullable=True))
    op.add_column("hosts", sa.Column("host", sa.String(), nullable=True))
    op.execute("UPDATE hosts SET sni = '', host = '';")
    with op.batch_alter_table('hosts') as batch_op:
        batch_op.alter_column("sni", nullable=False)
        batch_op.alter_column("host", nullable=False)


def downgrade() -> None:
    op.drop_column("hosts", "host")
    op.drop_column("hosts", "sni")

"""hosts.auto_select becomes a group number instead of a flag (YUKU)

Revision ID: yuku0011groups
Revises: yuku0010auto
Create Date: 2026-08-04

0 stays "not in any auto-select entry" and the 1s written while the column was
a boolean become group 1, so nothing has to be re-ticked in the panel.

SQLite is left alone on purpose: its typing is dynamic, the stored 0/1 already
read back as integers, and an ALTER there means rebuilding the table — which
would break the host_group_hosts rows that reference hosts.id (see the comment
in crud.update_hosts).
"""
import sqlalchemy as sa
from alembic import op


revision = 'yuku0011groups'
down_revision = 'yuku0010auto'
branch_labels = None
depends_on = None


def upgrade() -> None:
    if op.get_bind().dialect.name == "sqlite":
        return
    op.alter_column(
        'hosts', 'auto_select',
        existing_type=sa.Boolean(),
        type_=sa.Integer(),
        existing_nullable=False,
        existing_server_default='0',
    )


def downgrade() -> None:
    if op.get_bind().dialect.name == "sqlite":
        return
    # groups above 1 collapse to "in the auto-select entry"
    op.execute("UPDATE hosts SET auto_select = 1 WHERE auto_select > 1")
    op.alter_column(
        'hosts', 'auto_select',
        existing_type=sa.Integer(),
        type_=sa.Boolean(),
        existing_nullable=False,
        existing_server_default='0',
    )

"""hosts.auto_select — membership in the auto-select balancer (YUKU)

Revision ID: yuku0010auto
Revises: yuku0009hwid
Create Date: 2026-08-04

Hosts with the flag set are additionally emitted as one extra v2ray-json config
whose outbounds are load-balanced by Xray. Default 0 keeps every existing host
out of it, so the subscription is unchanged until the flag is ticked.
"""
import sqlalchemy as sa
from alembic import op


revision = 'yuku0010auto'
down_revision = 'yuku0009hwid'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        'hosts',
        sa.Column('auto_select', sa.Boolean(), server_default='0', nullable=False),
    )


def downgrade() -> None:
    op.drop_column('hosts', 'auto_select')

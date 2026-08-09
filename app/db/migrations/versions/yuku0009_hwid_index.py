"""index user_devices.hwid so panel search by HWID stays cheap (YUKU)

Revision ID: yuku0009hwid
Revises: yuku0008audit
Create Date: 2026-07-25

The existing unique constraint is (user_id, hwid) — with user_id leading it
can't serve a lookup by hwid alone, which is what the dashboard search does.
Index only, no data or schema change.
"""
from alembic import op


revision = 'yuku0009hwid'
down_revision = 'yuku0008audit'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_index('ix_user_devices_hwid', 'user_devices', ['hwid'])


def downgrade() -> None:
    op.drop_index('ix_user_devices_hwid', table_name='user_devices')

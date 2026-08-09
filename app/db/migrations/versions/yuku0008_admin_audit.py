"""admin action history (YUKU): audit log of mutating panel requests

Revision ID: yuku0008audit
Revises: yuku0007enf
Create Date: 2026-07-25

Purely additive — one new table, no ALTER on existing tables. Until the audit
middleware runs, nothing writes here and the feature is inert.

  admin_audit_logs   who (admin_username/admin_id), from where (ip/user_agent),
                     what (action/target/method/path/status_code) and the exact
                     old -> new payload in `details`

admin_username is a plain column rather than only a FK because the
env-configured sudoer (SUDO_USERNAME) has no row in `admins`.
"""
from alembic import op
import sqlalchemy as sa


revision = 'yuku0008audit'
down_revision = 'yuku0007enf'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        'admin_audit_logs',
        sa.Column('id', sa.Integer(), primary_key=True),
        sa.Column('created_at', sa.DateTime(), nullable=True),
        sa.Column('admin_username', sa.String(length=34), nullable=True),
        sa.Column('admin_id', sa.Integer(),
                  sa.ForeignKey('admins.id', ondelete='SET NULL'), nullable=True),
        sa.Column('action', sa.String(length=64), nullable=False),
        sa.Column('target_type', sa.String(length=32), nullable=True),
        sa.Column('target_name', sa.String(length=128), nullable=True),
        sa.Column('method', sa.String(length=8), nullable=True),
        sa.Column('path', sa.String(length=256), nullable=True),
        sa.Column('status_code', sa.Integer(), nullable=True),
        sa.Column('ip', sa.String(length=64), nullable=True),
        sa.Column('user_agent', sa.String(length=512), nullable=True),
        sa.Column('details', sa.JSON(), nullable=True),
    )
    op.create_index('ix_admin_audit_logs_created_at', 'admin_audit_logs', ['created_at'])
    op.create_index('ix_admin_audit_logs_admin_username', 'admin_audit_logs', ['admin_username'])
    op.create_index('ix_admin_audit_logs_action', 'admin_audit_logs', ['action'])
    op.create_index('ix_admin_audit_logs_target_name', 'admin_audit_logs', ['target_name'])


def downgrade() -> None:
    op.drop_index('ix_admin_audit_logs_target_name', table_name='admin_audit_logs')
    op.drop_index('ix_admin_audit_logs_action', table_name='admin_audit_logs')
    op.drop_index('ix_admin_audit_logs_admin_username', table_name='admin_audit_logs')
    op.drop_index('ix_admin_audit_logs_created_at', table_name='admin_audit_logs')
    op.drop_table('admin_audit_logs')

"""add revocable browser admin sessions

Revision ID: 31d941bdb713
Revises: 2b231de97dc3
Create Date: 2026-11-01
"""
import sqlalchemy as sa
from alembic import op

revision = "31d941bdb713"
down_revision = "2b231de97dc3"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "admin_sessions",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("session_hash", sa.String(length=64), nullable=False),
        sa.Column("username", sa.String(length=34), nullable=False),
        sa.Column("expires_at", sa.DateTime(), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_admin_sessions_session_hash", "admin_sessions", ["session_hash"], unique=True)
    op.create_index("ix_admin_sessions_username", "admin_sessions", ["username"], unique=False)
    op.create_index("ix_admin_sessions_expires_at", "admin_sessions", ["expires_at"], unique=False)


def downgrade() -> None:
    op.drop_index("ix_admin_sessions_expires_at", table_name="admin_sessions")
    op.drop_index("ix_admin_sessions_username", table_name="admin_sessions")
    op.drop_index("ix_admin_sessions_session_hash", table_name="admin_sessions")
    op.drop_table("admin_sessions")

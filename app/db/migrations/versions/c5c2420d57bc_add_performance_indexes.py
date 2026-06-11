"""add performance indexes

Adds indexes on columns that are filtered on every periodic job and in
per-user usage lookups, but were previously unindexed:

- users.status      (review_users, reset_user_data_usage, autodelete, disable_all)
- users.expire      (expiry checks)
- users.admin_id    (filtering users by admin)
- node_user_usages.user_id        (per-user traffic aggregation)
- notification_reminders.user_id  (per-user reminder lookups in a tight loop)

These are non-destructive CREATE INDEX operations and are safe to run with
zero downtime on existing deployments.

Revision ID: c5c2420d57bc
Revises: 2b231de97dc3
Create Date: 2026-06-11 17:10:00.000000

"""
from alembic import op


# revision identifiers, used by Alembic.
revision = 'c5c2420d57bc'
down_revision = '2b231de97dc3'
branch_labels = None
depends_on = None


def upgrade() -> None:
    with op.batch_alter_table('users') as batch_op:
        batch_op.create_index('ix_users_status', ['status'])
        batch_op.create_index('ix_users_expire', ['expire'])
        batch_op.create_index('ix_users_admin_id', ['admin_id'])

    with op.batch_alter_table('node_user_usages') as batch_op:
        batch_op.create_index('ix_node_user_usages_user_id', ['user_id'])

    with op.batch_alter_table('notification_reminders') as batch_op:
        batch_op.create_index('ix_notification_reminders_user_id', ['user_id'])


def downgrade() -> None:
    with op.batch_alter_table('notification_reminders') as batch_op:
        batch_op.drop_index('ix_notification_reminders_user_id')

    with op.batch_alter_table('node_user_usages') as batch_op:
        batch_op.drop_index('ix_node_user_usages_user_id')

    with op.batch_alter_table('users') as batch_op:
        batch_op.drop_index('ix_users_admin_id')
        batch_op.drop_index('ix_users_expire')
        batch_op.drop_index('ix_users_status')

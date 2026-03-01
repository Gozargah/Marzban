"""user_bot_fields

Revision ID: a1b2c3d4e5f6
Revises: 07f9bbb3db4e
Create Date: 2026-03-01 12:00:00.000000

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = 'a1b2c3d4e5f6'
down_revision = '07f9bbb3db4e'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column('users', sa.Column('telegram_id', sa.BigInteger(), nullable=True))
    op.add_column('users', sa.Column('referral_code', sa.String(16), nullable=True))
    op.add_column('users', sa.Column('referred_by_id', sa.Integer(), nullable=True))

    try:
        op.create_unique_constraint('uq_users_telegram_id', 'users', ['telegram_id'])
        op.create_unique_constraint('uq_users_referral_code', 'users', ['referral_code'])
        op.create_foreign_key(
            'fk_users_referred_by_id', 'users', 'users',
            ['referred_by_id'], ['id']
        )
    except Exception:
        # SQLite doesn't support all constraints via ALTER TABLE
        pass


def downgrade() -> None:
    try:
        op.drop_constraint('fk_users_referred_by_id', 'users', type_='foreignkey')
        op.drop_constraint('uq_users_referral_code', 'users', type_='unique')
        op.drop_constraint('uq_users_telegram_id', 'users', type_='unique')
    except Exception:
        pass
    op.drop_column('users', 'referred_by_id')
    op.drop_column('users', 'referral_code')
    op.drop_column('users', 'telegram_id')

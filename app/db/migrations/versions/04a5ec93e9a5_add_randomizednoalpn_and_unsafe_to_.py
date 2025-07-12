"""add randomizednoalpn and unsafe to fingerprints

Revision ID: 04a5ec93e9a5
Revises: 8fe407cf56c9
Create Date: 2025-07-10 14:55:05.980537

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = '04a5ec93e9a5'
down_revision = '8fe407cf56c9'
branch_labels = None
depends_on = None

# Previous enum (without the new values)
old_fingerprint = sa.Enum(
    "none", "chrome", "firefox", "safari", "ios", "android", "edge",
    "360", "qq", "random", "randomized",
    name="proxyhostfingerprint"
)

# New enum (with added values)
new_fingerprint = sa.Enum(
    "none", "chrome", "firefox", "safari", "ios", "android", "edge",
    "360", "qq", "random", "randomized", "randomizednoalpn", "unsafe",
    name="proxyhostfingerprint"
)

def upgrade():
    bind = op.get_bind()
    dialect = bind.dialect.name

    if dialect == "postgresql":
        op.execute("ALTER TYPE proxyhostfingerprint ADD VALUE IF NOT EXISTS 'randomizednoalpn'")
        op.execute("ALTER TYPE proxyhostfingerprint ADD VALUE IF NOT EXISTS 'unsafe'")
    else:
        with op.batch_alter_table("hosts", schema=None) as batch_op:
            batch_op.alter_column(
                "fingerprint",
                type_=new_fingerprint,
                existing_type=old_fingerprint,
                existing_nullable=True
            )


def downgrade():
    bind = op.get_bind()
    dialect = bind.dialect.name

    if dialect == "postgresql":
        # Rename old type
        op.execute("ALTER TYPE proxyhostfingerprint RENAME TO proxyhostfingerprint_old")

        # Create new (downgraded) enum type
        op.execute("""
            CREATE TYPE proxyhostfingerprint AS ENUM (
                'none', 'chrome', 'firefox', 'safari', 'ios',
                'android', 'edge', '360', 'qq', 'random', 'randomized'
            )
        """)

        # Alter the column to use the new enum
        op.execute("""
            ALTER TABLE hosts
            ALTER COLUMN fingerprint TYPE proxyhostfingerprint
            USING fingerprint::text::proxyhostfingerprint
        """)

        # Drop the old enum type
        op.execute("DROP TYPE proxyhostfingerprint_old")

    else:
        # SQLite / MySQL: Just switch enum type
        with op.batch_alter_table("hosts", schema=None) as batch_op:
            batch_op.alter_column(
                "fingerprint",
                type_=old_fingerprint,
                existing_type=new_fingerprint,
                existing_nullable=True
            )
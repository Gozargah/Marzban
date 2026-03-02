"""add hysteria2 proxy type

Revision ID: a1b2c3d4e5f6
Revises: 5c4d9379ed7f
Create Date: 2026-02-28 00:00:00.000000

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import mysql

# revision identifiers, used by Alembic.
revision = 'a1b2c3d4e5f6'
down_revision = '2b231de97dc3'
branch_labels = None
depends_on = None

NEW_ENUM = ('VMess', 'VLESS', 'Trojan', 'Shadowsocks', 'HYSTERIA2')
OLD_ENUM = ('VMess', 'VLESS', 'Trojan', 'Shadowsocks')


def upgrade() -> None:
    bind = op.get_bind()
    if bind.dialect.name == 'mysql':
        # MySQL requires an explicit ALTER TABLE to extend the ENUM
        op.execute(
            "ALTER TABLE proxies MODIFY COLUMN `type` "
            "ENUM('VMess','VLESS','Trojan','Shadowsocks','HYSTERIA2') NOT NULL"
        )
    else:
        # SQLite: recreate column via batch_alter (SQLite ignores ENUM, uses TEXT)
        with op.batch_alter_table('proxies') as batch_op:
            batch_op.alter_column(
                'type',
                existing_type=sa.Enum(*OLD_ENUM, name='proxytypes'),
                type_=sa.Enum(*NEW_ENUM, name='proxytypes'),
                existing_nullable=False,
            )


def downgrade() -> None:
    bind = op.get_bind()
    if bind.dialect.name == 'mysql':
        op.execute(
            "ALTER TABLE proxies MODIFY COLUMN `type` "
            "ENUM('VMess','VLESS','Trojan','Shadowsocks') NOT NULL"
        )
    else:
        with op.batch_alter_table('proxies') as batch_op:
            batch_op.alter_column(
                'type',
                existing_type=sa.Enum(*NEW_ENUM, name='proxytypes'),
                type_=sa.Enum(*OLD_ENUM, name='proxytypes'),
                existing_nullable=False,
            )

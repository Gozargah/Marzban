"""regenerate node tls certificate

Revision ID: f1c2a5e9d3b7
Revises: 98fd017bc870
Create Date: 2026-07-31 12:00:00.000000

The panel<->node mTLS handshake pins the peer name to the literal string
"Gozargah" (matching what the unmodified upstream Marzban-node image
presents), but an earlier rebrand accidentally generated new installs'
panel certificate with CN="Arsi" instead, and the node-connection code
briefly expected "Arsi" too. Any TLS row created while that was in place
is now permanently mismatched against every node's real certificate.
Regenerating it here (with the corrected CN) fixes existing databases;
nodes will need the freshly downloaded certificate placed on them again.
"""
import sqlalchemy as sa
from alembic import op

from app.utils.crypto import generate_certificate

revision = 'f1c2a5e9d3b7'
down_revision = '98fd017bc870'
branch_labels = None
depends_on = None


def upgrade() -> None:
    conn = op.get_bind()
    tls = generate_certificate()

    tls_table = sa.table(
        'tls',
        sa.column('id', sa.Integer),
        sa.column('key', sa.String),
        sa.column('certificate', sa.String),
    )

    existing = conn.execute(sa.text("SELECT id FROM tls LIMIT 1")).first()
    if existing:
        conn.execute(
            tls_table.update().where(tls_table.c.id == existing[0]).values(
                key=tls['key'], certificate=tls['cert']
            )
        )
    else:
        conn.execute(
            tls_table.insert().values(id=1, key=tls['key'], certificate=tls['cert'])
        )


def downgrade() -> None:
    pass

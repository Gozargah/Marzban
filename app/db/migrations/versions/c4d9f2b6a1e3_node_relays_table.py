"""node relays table (one node, many relay targets)

Revision ID: c4d9f2b6a1e3
Revises: b8f4c1a7e2d9
Create Date: 2026-08-04 12:00:00.000000

"""
import sqlalchemy as sa
from alembic import op

revision = 'c4d9f2b6a1e3'
down_revision = 'b8f4c1a7e2d9'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        'node_relays',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('node_id', sa.Integer(), nullable=True),
        sa.Column('listen_port', sa.Integer(), nullable=False),
        sa.Column('target_address', sa.String(length=256), nullable=False),
        sa.Column('target_port', sa.Integer(), nullable=False),
        sa.ForeignKeyConstraint(['node_id'], ['nodes.id'], ),
        sa.PrimaryKeyConstraint('id'),
    )

    conn = op.get_bind()
    existing = conn.execute(sa.text(
        "SELECT id, relay_listen_port, relay_target_address, relay_target_port FROM nodes "
        "WHERE relay_listen_port IS NOT NULL AND relay_target_address IS NOT NULL AND relay_target_port IS NOT NULL"
    )).fetchall()
    if existing:
        node_relays_table = sa.table(
            'node_relays',
            sa.column('node_id', sa.Integer),
            sa.column('listen_port', sa.Integer),
            sa.column('target_address', sa.String),
            sa.column('target_port', sa.Integer),
        )
        conn.execute(node_relays_table.insert(), [
            {
                'node_id': row[0],
                'listen_port': row[1],
                'target_address': row[2],
                'target_port': row[3],
            }
            for row in existing
        ])

    with op.batch_alter_table('nodes') as batch_op:
        batch_op.drop_column('relay_target_port')
        batch_op.drop_column('relay_target_address')
        batch_op.drop_column('relay_listen_port')


def downgrade() -> None:
    with op.batch_alter_table('nodes') as batch_op:
        batch_op.add_column(sa.Column('relay_listen_port', sa.Integer(), nullable=True))
        batch_op.add_column(sa.Column('relay_target_address', sa.String(length=256), nullable=True))
        batch_op.add_column(sa.Column('relay_target_port', sa.Integer(), nullable=True))

    op.drop_table('node_relays')

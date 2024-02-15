"""fix_mysql_collations

Revision ID: dd725e4d3628
Revises: 5575fe410515
Create Date: 2024-02-15 21:13:26.606283

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = 'dd725e4d3628'
down_revision = '5575fe410515'
branch_labels = None
depends_on = None


def upgrade() -> None:
    bind = op.get_bind()

    if bind.engine.name == 'mysql':

        op.alter_column('nodes', 'name', type_=sa.String(length=256, collation='utf8mb4_bin'), nullable=True)
        op.alter_column('users', 'username', type_=sa.String(length=34, collation='utf8mb4_bin'), nullable=True)

        op.drop_constraint(
            'template_inbounds_association_ibfk_1',
            'template_inbounds_association',
            type_='foreignkey'
        )
        op.drop_constraint(
            'hosts_ibfk_1',
            'hosts',
            type_='foreignkey'
        )
        op.drop_constraint(
            'exclude_inbounds_association_ibfk_1',
            'exclude_inbounds_association',
            type_='foreignkey')

        op.alter_column(
            'inbounds', 'tag',
            type_=sa.String(length=256, collation='utf8mb4_bin'),
            nullable=False
        )
        op.alter_column(
            'template_inbounds_association', 'inbound_tag',
            type_=sa.String(length=256, collation='utf8mb4_bin'),
            nullable=False
        )
        op.alter_column(
            'hosts', 'inbound_tag',
            type_=sa.String(length=256, collation='utf8mb4_bin'),
            nullable=False
        )
        op.alter_column(
            'exclude_inbounds_association', 'inbound_tag',
            type_=sa.String(length=256, collation='utf8mb4_bin'),
            nullable=False
        )

        op.create_foreign_key(
            'template_inbounds_association_ibfk_1',
            'template_inbounds_association', 'inbounds',
            ['inbound_tag'], ['tag'],
        )
        op.create_foreign_key(
            'hosts_ibfk_1',
            'hosts', 'inbounds',
            ['inbound_tag'], ['tag'],
        )
        op.create_foreign_key(
            'exclude_inbounds_association_ibfk_1',
            'exclude_inbounds_association', 'inbounds',
            ['inbound_tag'], ['tag'],
        )


def downgrade() -> None:
    bind = op.get_bind()

    if bind.engine.name == 'mysql':
        op.alter_column('nodes', 'name', type_=sa.String(length=256, collation='utf8mb4_general_ci'), nullable=True)
        op.alter_column('users', 'username', type_=sa.String(length=34, collation='utf8mb4_general_ci'), nullable=True)

        op.drop_constraint(
            'template_inbounds_association_ibfk_1',
            'template_inbounds_association',
            type_='foreignkey'
        )
        op.drop_constraint(
            'hosts_ibfk_1',
            'hosts',
            type_='foreignkey'
        )
        op.drop_constraint(
            'exclude_inbounds_association_ibfk_1',
            'exclude_inbounds_association',
            type_='foreignkey')

        op.alter_column(
            'inbounds', 'tag',
            type_=sa.String(length=256, collation='utf8mb4_general_ci'),
            nullable=False
        )
        op.alter_column(
            'template_inbounds_association', 'inbound_tag',
            type_=sa.String(length=256, collation='utf8mb4_general_ci'),
            nullable=False
        )
        op.alter_column(
            'hosts', 'inbound_tag',
            type_=sa.String(length=256, collation='utf8mb4_general_ci'),
            nullable=False
        )
        op.alter_column(
            'exclude_inbounds_association', 'inbound_tag',
            type_=sa.String(length=256, collation='utf8mb4_general_ci'),
            nullable=False
        )

        op.create_foreign_key(
            'template_inbounds_association_ibfk_1',
            'template_inbounds_association', 'inbounds',
            ['inbound_tag'], ['tag'],
        )
        op.create_foreign_key(
            'hosts_ibfk_1',
            'hosts', 'inbounds',
            ['inbound_tag'], ['tag'],
        )
        op.create_foreign_key(
            'exclude_inbounds_association_ibfk_1',
            'exclude_inbounds_association', 'inbounds',
            ['inbound_tag'], ['tag'],
        )

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
    metadata = sa.MetaData()
    metadata.reflect(bind=bind.engine)

    if bind.engine.name == 'mysql':

        constraints = []
        for table_name, table in metadata.tables.items():
            for constraint in table.foreign_key_constraints:
                if (
                    isinstance(constraint, sa.sql.schema.ForeignKeyConstraint)
                    and constraint.referred_table.name == 'inbounds'
                ):
                    for element in constraint.elements:
                        if element.column.name == 'tag':
                            constraints.append(constraint)

        op.alter_column('nodes', 'name', type_=sa.String(length=256, collation='utf8mb4_bin'), nullable=True)
        op.alter_column('users', 'username', type_=sa.String(length=34, collation='utf8mb4_bin'), nullable=True)

        for cons in constraints:
            op.drop_constraint(
                cons.name,
                cons.table.name,
                type_='foreignkey'
            )

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

        for cons in constraints:
            op.create_foreign_key(
                cons.name,
                cons.table.name, cons.referred_table.name,
                [c.name for c in cons.columns], ['tag'],
            )


def downgrade() -> None:
    bind = op.get_bind()
    metadata = sa.MetaData()
    metadata.reflect(bind=bind.engine)

    if bind.engine.name == 'mysql':

        constraints = []
        for table_name, table in metadata.tables.items():
            for constraint in table.foreign_key_constraints:
                if (
                    isinstance(constraint, sa.sql.schema.ForeignKeyConstraint)
                    and constraint.referred_table.name == 'inbounds'
                ):
                    for element in constraint.elements:
                        if element.column.name == 'tag':
                            constraints.append(constraint)

        op.alter_column('nodes', 'name', type_=sa.String(length=256, collation='utf8mb4_general_ci'), nullable=True)
        op.alter_column('users', 'username', type_=sa.String(length=34, collation='utf8mb4_general_ci'), nullable=True)

        for cons in constraints:
            op.drop_constraint(
                cons.name,
                cons.table.name,
                type_='foreignkey'
            )

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

        for cons in constraints:
            op.create_foreign_key(
                cons.name,
                cons.table.name, cons.referred_table.name,
                [c.name for c in cons.columns], ['tag'],
            )

"""Fix User Template

Revision ID: 714f227201a7
Revises: 947ebbd8debe
Create Date: 2023-10-29 13:45:03.223039

"""
from alembic import op
import sqlalchemy as sa
from config import SQLALCHEMY_DATABASE_URL


# revision identifiers, used by Alembic.
revision = '714f227201a7'
down_revision = '947ebbd8debe'
branch_labels = None
depends_on = None

def upgrade() -> None:
    # ### commands auto generated by Alembic - please adjust! ###
    with op.batch_alter_table('user_templates') as batch_op:
        batch_op.alter_column('data_limit',existing_type=sa.BigInteger,
                              nullable=True)
        batch_op.alter_column('expire_duration',existing_type=sa.BigInteger,
                              nullable=True)
    # ### end Alembic commands ###


def downgrade():
    # ### commands auto generated by Alembic - please adjust! ###
    with op.batch_alter_table('user_templates') as batch_op:
        batch_op.alter_column('data_limit',existing_type=sa.Integer,
                              nullable=False)
        batch_op.alter_column('expire_duration',existing_type=sa.Integer,
                              nullable=False)
    # ### end Alembic commands ###
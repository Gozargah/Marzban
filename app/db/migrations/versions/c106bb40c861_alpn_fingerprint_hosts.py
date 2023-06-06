"""alpn_fingerprint_hosts

Revision ID: c106bb40c861
Revises: 57fda18cd9e6
Create Date: 2023-05-05 18:50:45.505537

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = 'c106bb40c861'
down_revision = '57fda18cd9e6'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # ### commands auto generated by Alembic - please adjust! ###
    op.add_column('hosts', sa.Column('alpn', sa.Enum('none', 'h2', 'http/1.1', 'h2,http/1.1',
                  name='proxyhostalpn'), server_default='none', nullable=False))
    op.add_column('hosts', sa.Column('fingerprint', sa.Enum('none', 'chrome', 'firefox', 'safari', 'ios', 'android',
                  'edge', '360', 'qq', 'random', 'randomized', name='proxyhostfingerprint'), server_default='none', nullable=False))
    # ### end Alembic commands ###


def downgrade() -> None:
    # ### commands auto generated by Alembic - please adjust! ###
    op.drop_column('hosts', 'fingerprint')
    op.drop_column('hosts', 'alpn')
    # ### end Alembic commands ###

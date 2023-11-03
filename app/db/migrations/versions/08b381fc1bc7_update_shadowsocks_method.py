"""update_shadowsocks_method

Revision ID: 08b381fc1bc7
Revises: 0f720f5c54dd
Create Date: 2023-11-03 13:41:57.120379

"""
from alembic import op
import sqlalchemy as sa
import json

# revision identifiers, used by Alembic.
revision = '08b381fc1bc7'
down_revision = '0f720f5c54dd'
branch_labels = None
depends_on = None


def upgrade() -> None:
    bind = op.get_bind()
    q = bind.execute("SELECT id, settings FROM proxies WHERE type = 'Shadowsocks';")
    proxies = q.fetchall()
    for pid, settings in proxies:
        settings = json.loads(settings)
        if settings.get('method') == 'chacha20-poly1305':
            new_settings = settings.copy()
            new_settings['method'] = 'chacha20-ietf-poly1305'
            bind.execute(f"UPDATE proxies SET settings = '{json.dumps(new_settings)}' WHERE id = {pid}")


def downgrade() -> None:
    bind = op.get_bind()
    q = bind.execute("SELECT id, settings FROM proxies WHERE type = 'Shadowsocks';")
    proxies = q.fetchall()
    for pid, settings in proxies:
        settings = json.loads(settings)
        if settings.get('method') == 'chacha20-ietf-poly1305':
            new_settings = settings.copy()
            new_settings['method'] = 'chacha20-poly1305'
            bind.execute(f"UPDATE proxies SET settings = '{json.dumps(new_settings)}' WHERE id = {pid}")

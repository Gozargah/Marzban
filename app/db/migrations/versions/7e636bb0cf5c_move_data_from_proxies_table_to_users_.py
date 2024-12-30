"""move data from proxies table to users table

Revision ID: 7e636bb0cf5c
Revises: ed16dd5f1bc4
Create Date: 2024-12-26 19:26:56.414228

"""
from uuid import uuid4

import sqlalchemy as sa
from alembic import op
from sqlalchemy.orm import Session

from app.db.models import User
from app.utils.system import random_password

# revision identifiers, used by Alembic.
revision = '7e636bb0cf5c'
down_revision = 'ed16dd5f1bc4'
branch_labels = None
depends_on = None


def upgrade() -> None:
    bind = op.get_bind()
    db = Session(bind=bind)
    proxy_table = sa.table(
        'proxies',
        sa.column('id', sa.Integer),
        sa.column('user_id', sa.Integer),
        sa.column('type', sa.String),
        sa.column('settings', sa.JSON)
    )
    count_result = db.query(proxy_table).count()
    if count_result <= 0:
        return
    proxies = db.execute(
        sa.select(
            proxy_table.c.user_id,
            proxy_table.c.type,
            proxy_table.c.settings
        )
    ).fetchall()
    user_proxy_map = {}
    for user_id, proxy_type, settings in proxies:
        if user_id not in user_proxy_map:
            user_proxy_map[user_id] = {}
        user_proxy_map[user_id][proxy_type.lower()] = settings

    for user_id, proxy in user_proxy_map.items():
        if "vmess" not in proxy:
            user_proxy_map[user_id]["vmess"] = {"id": str(uuid4())}
        if "vless" not in proxy:
            user_proxy_map[user_id]["vless"] = {"id": str(uuid4()), "flow": ""}
        if "trojan" not in proxy:
            user_proxy_map[user_id]["trojan"] = {"password": random_password(), "flow": ""}
        if "shadowsocks" not in proxy:
            user_proxy_map[user_id]["shadowsocks"] = {
                "password": random_password(),  "method": "chacha20-ietf-poly1305"}
    updates = [
        {'id': user_id, 'proxy_settings': settings}
        for user_id, settings in user_proxy_map.items()
    ]

    db.bulk_update_mappings(User, updates)
    db.commit()


def downgrade() -> None:
    pass

from sqlalchemy.orm import load_only, selectinload
from sqlalchemy import select
from GozargahNodeBridge import create_user, create_proxy

from app.db import AsyncSession
from app.db.models import ProxyInbound, Group, User, UserStatus


def serialize_user_for_node(id: int, username: str, user_settings: dict, inbounds: list[str] = None):
    vmess_settings = user_settings.get("vmess", {})
    vless_settings = user_settings.get("vless", {})
    trojan_settings = user_settings.get("trojan", {})
    shadowsocks_settings = user_settings.get("shadowsocks", {})

    return create_user(
        f"{id}.{username}",
        create_proxy(
            vmess_id=vmess_settings.get("id"),
            vless_id=vless_settings.get("id"),
            vless_flow=vless_settings.get("flow"),
            trojan_password=trojan_settings.get("password"),
            shadowsocks_password=shadowsocks_settings.get("password"),
            shadowsocks_method=shadowsocks_settings.get("method"),
        ),
        inbounds,
    )


async def core_users(db: AsyncSession):
    stmt = (
        select(User)
        .options(
            load_only(User.id, User.username, User.proxy_settings),
            selectinload(User.groups),
            selectinload(User.groups).selectinload(Group.inbounds).load_only(ProxyInbound.tag),
        )
        .filter(User.status.in_([UserStatus.active, UserStatus.on_hold]))
    )
    users = (await db.execute(stmt)).unique().scalars().all()
    bridge_users: list = []

    for user in users:
        inbounds_list = await user.inbounds()
        if len(inbounds_list) > 0:
            bridge_users.append(serialize_user_for_node(user.id, user.username, user.proxy_settings, inbounds_list))

    return bridge_users

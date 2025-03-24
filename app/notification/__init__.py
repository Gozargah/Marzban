import asyncio

from . import discord as ds
from . import telegram as tg
from app.models.host import BaseHost
from app.models.user_template import UserTemplateResponse
from app.models.node import NodeResponse
from app.models.group import GroupResponse
from app.models.admin import Admin


async def add_host(host: BaseHost, by: str):
    asyncio.gather(ds.add_host(host, by), tg.add_host(host, by))


async def modify_host(host: BaseHost, by: str):
    asyncio.gather(ds.modify_host(host, by), tg.modify_host(host, by))


async def remove_host(host: BaseHost, by: str):
    asyncio.gather(ds.remove_host(host, by), tg.remove_host(host, by))


async def update_hosts(by: str):
    asyncio.gather(ds.update_hosts(by), tg.update_hosts(by))


async def add_user_template(user: UserTemplateResponse, by: str):
    asyncio.gather(ds.add_user_template(user, by), tg.add_user_template(user, by))


async def modify_user_template(user: UserTemplateResponse, by: str):
    asyncio.gather(ds.modify_user_template(user, by), tg.modify_user_template(user, by))


async def remove_user_template(name: str, by: str):
    asyncio.gather(ds.remove_user_template(name, by), tg.remove_user_template(name, by))


async def add_node(node: NodeResponse, by: str):
    asyncio.gather(ds.add_node(node, by), tg.add_node(node, by))


async def modify_node(node: NodeResponse, by: str):
    asyncio.gather(ds.modify_host(node, by), tg.modify_node(node, by))


async def remove_node(node: NodeResponse, by: str):
    asyncio.gather(ds.remove_node(node, by), tg.remove_node(node, by))


async def add_group(group: GroupResponse, by: str):
    asyncio.gather(ds.add_group(group, by), tg.add_group(group, by))


async def modify_group(group: GroupResponse, by: str):
    asyncio.gather(ds.modify_group(group, by), tg.modify_group(group, by))


async def remove_group(group_id: int, by: str):
    asyncio.gather(ds.remove_group(group_id, by), tg.remove_group(group_id, by))


async def add_admin(admin: Admin, by: str):
    asyncio.gather(ds.add_admin(admin, by), tg.add_admin(admin, by))


async def modify_admin(admin: Admin, by: str):
    asyncio.gather(ds.modify_admin(admin, by), tg.modify_admin(admin, by))


async def remove_admin(username: str, by: str):
    asyncio.gather(ds.remove_admin(username, by), tg.remove_admin(username, by))


async def admin_usage_reset(admin: Admin, by: str):
    asyncio.gather(ds.admin_reset_usage(admin, by), tg.admin_reset_usage(admin, by))


async def admin_login(username: str, password: str, client_ip: str, success: bool):
    asyncio.gather(
        ds.admin_login(username, password, client_ip, success), tg.admin_login(username, password, client_ip, success)
    )

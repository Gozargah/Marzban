import asyncio

from sqlalchemy.exc import IntegrityError
from GozargahNodeBridge import GozargahNode, NodeAPIError

from app.operation import BaseOperator
from app.models.node import NodeCreate, NodeResponse, NodeSettings, NodesUsageResponse, NodeModify, NodeStats
from app.models.admin import AdminDetails
from app.db.models import Node, NodeStatus
from app.db import AsyncSession
from app.db.crud import (
    create_node,
    get_node_by_id,
    update_node_status,
    get_nodes,
    remove_node,
    get_nodes_usage,
    update_node,
    get_user,
)
from app.db.base import GetDB
from app.backend import config
from app.node import get_tls, backend_users, node_manager
from app.utils.logger import get_logger
from app import notification


logger = get_logger("node-operator")


class NodeOperator(BaseOperator):
    async def get_node_settings(self) -> NodeSettings:
        return NodeSettings(certificate=(await get_tls()).certificate)

    async def get_db_nodes(self, db: AsyncSession, offset: int | None, limit: int | None) -> list[NodeResponse]:
        return await get_nodes(db=db, offset=offset, limit=limit)

    @staticmethod
    async def connect_node(node_id: int) -> None:
        gozargah_node: GozargahNode | None = await node_manager.get_node(node_id)
        if gozargah_node is None:
            return

        with GetDB() as db:
            db_node = await get_node_by_id(db, node_id)

            if db_node is None:
                return

            logger.info(f'Connecting to "{db_node.name}" node')
            update_node_status(db, db_node, NodeStatus.connecting)

            try:
                info = await gozargah_node.start(
                    config=config.to_json(),
                    backend_type=0,
                    users=await backend_users(inbounds=config.inbounds),
                    keep_alive=db_node.keep_alive,
                    timeout=10,
                )
                await update_node_status(
                    db=db,
                    dbnode=db_node,
                    status=NodeStatus.connected,
                    xray_version=info.core_version,
                    node_version=info.node_version,
                )
                logger.info(
                    f'Connected to "{db_node.name}" node v{info.node_version}, xray run on v{info.core_version}'
                )
            except NodeAPIError as e:
                logger.error(f"Failed to connect node {db_node.name} with id {db_node.id}: {e.detail}")
                if e.code == -4:
                    return

                await update_node_status(db=db, dbnode=db_node, status=NodeStatus.error, message=e.detail)

    async def add_node(self, db: AsyncSession, new_node: NodeCreate, admin: AdminDetails) -> NodeResponse:
        try:
            db_node = await create_node(db, new_node)
        except IntegrityError:
            await db.rollback()
            self.raise_error(message=f'Node "{new_node.name}" already exists', code=409)

        await node_manager.update_node(db_node)

        asyncio.create_task(self.connect_node(node_id=db_node.id))

        logger.info(f'New node "{db_node.name}" with id "{db_node.id}" added by admin "{admin.username}"')

        node = NodeResponse.model_validate(db_node)

        asyncio.create_task(notification.add_node(node, admin.username))

        return node

    async def modify_node(
        self, db: AsyncSession, node_id: Node, modified_node: NodeModify, admin: AdminDetails
    ) -> Node:
        db_node: Node = await self.get_validated_node(db=db, node_id=node_id)
        try:
            db_node = await update_node(db, db_node, modified_node)
        except IntegrityError:
            await db.rollback()
            self.raise_error(message=f'Node "{db_node.name}" already exists', code=409)

        if db_node.status is NodeStatus.disabled:
            await node_manager.remove_node(db_node.id)
        else:
            await node_manager.update_node(db_node)
            asyncio.create_task(self.connect_node(node_id=db_node.id))

        logger.info(f'Node "{db_node.name}" with id "{db_node.id}" modified by admin "{admin.username}"')

        node = NodeResponse.model_validate(db_node)

        asyncio.create_task(notification.modify_node(node, admin.username))

        return node

    async def remove_node(self, db: AsyncSession, node_id: Node, admin: AdminDetails) -> None:
        db_node: Node = await self.get_validated_node(db=db, node_id=node_id)

        await node_manager.remove_node(db_node.id)
        await remove_node(db=db, db_node=db_node)

        logger.info(f'Node "{db_node.name}" with id "{db_node.id}" deleted by admin "{admin.username}"')

        asyncio.create_task(notification.remove_host(db_node, admin.username))

    async def restart_node(self, node_id: Node, admin: AdminDetails) -> None:
        asyncio.create_task(self.connect_node(node_id))
        logger.info(f'Node "{node_id}" restarted by admin "{admin.username}"')

    async def restart_all_node(self, db: AsyncSession, admin: AdminDetails) -> None:
        for db_node in await get_nodes(db=db, enabled=True):
            await asyncio.create_task(self.connect_node(db_node.id))
        logger.info(f'All Node\'s restarted by admin "{admin.username}"')

    async def get_usage(self, db: AsyncSession, start: str = "", end: str = "") -> NodesUsageResponse:
        start, end = self.validate_dates(start, end)
        usages = await get_nodes_usage(db, start, end)

        return {"usages": usages}

    async def get_logs(self, node_id: Node) -> asyncio.Queue:
        node = await node_manager.get_node(node_id)

        if node is None:
            self.raise_error(message="Node not found", code=404)

        try:
            logs_queue = await node.get_logs()
        except NodeAPIError as e:
            self.raise_error(message=e.detail, code=e.code)

        return logs_queue

    async def get_node_system_stats(self, node_id: Node) -> NodeStats:
        node = await node_manager.get_node(node_id)

        if node is None:
            self.raise_error(message="Node not found", code=404)

        try:
            stats = await node.get_system_stats()
        except NodeAPIError as e:
            self.raise_error(message=e.detail, code=e.code)

        if stats is None:
            self.raise_error(message="Stats not found", code=404)

        return NodeStats(
            mem_total=stats.mem_total,
            mem_used=stats.mem_used,
            cpu_cores=stats.cpu_cores,
            cpu_usage=stats.cpu_usage,
            incoming_bandwidth_speed=stats.incoming_bandwidth_speed,
            outgoing_bandwidth_speed=stats.outgoing_bandwidth_speed,
        )

    async def get_nodes_system_stats(self) -> dict[int, NodeStats | None]:
        nodes = await node_manager.get_healthy_nodes()
        stats_tasks = {id: asyncio.create_task(self._get_node_stats_safe(id)) for id, _ in nodes}

        await asyncio.gather(*stats_tasks.values(), return_exceptions=True)

        results = {}
        for node_id, task in stats_tasks.items():
            if task.exception():
                results[node_id] = None
            else:
                results[node_id] = task.result()

        return results

    async def _get_node_stats_safe(self, node_id: Node) -> NodeStats | None:
        """Wrapper method that returns None instead of raising exceptions"""
        try:
            return await self.get_node_system_stats(node_id)
        except Exception as e:
            logger.error(f"Error getting system stats for node {node_id}: {e}")
            return None

    async def get_user_online_stats_by_node(self, db: AsyncSession, node_id: Node, username: str) -> dict[int, int]:
        db_user = get_user(db, username=username)
        if db_user is None:
            self.raise_error(message="User not found", code=404)

        node = await node_manager.get_node(node_id)

        if node is None:
            self.raise_error(message="Node not found", code=404)

        try:
            stats = await node.get_user_online_stats(email=f"{db_user.id}.{db_user.username}")
        except NodeAPIError as e:
            self.raise_error(message=e.detail, code=e.code)

        if stats is None:
            self.raise_error(message="Stats not found", code=404)

        return {node_id: stats.value}

    async def get_user_ip_list_by_node(
        self, db: AsyncSession, node_id: Node, username: str
    ) -> dict[int, dict[str, int]]:
        db_user = get_user(db, username=username)
        if db_user is None:
            self.raise_error(message="User not found", code=404)

        node = await node_manager.get_node(node_id)

        if node is None:
            self.raise_error(message="Node not found", code=404)

        try:
            stats = await node.get_user_online_ip_list(email=f"{db_user.id}.{db_user.username}")
        except NodeAPIError as e:
            self.raise_error(message=e.detail, code=e.code)

        if stats is None:
            self.raise_error(message="Stats not found", code=404)

        return {node_id: stats.ips}

    async def sync_node_users(self, db: AsyncSession, node_id: int, flush_users: bool = False) -> NodeResponse:
        db_node = await self.get_validated_node(db, node_id=node_id)

        if db_node.status != NodeStatus.connected:
            self.raise_error(message="Node is not connected", code=406)

        gozargah_node = await node_manager.get_node(node_id)
        if gozargah_node is None:
            self.raise_error(message="Node is not connected", code=409)

        try:
            await gozargah_node.sync_users(await backend_users(config.inbounds), flush_queue=flush_users)
        except NodeAPIError as e:
            await update_node_status(db=db, dbnode=db_node, status=NodeStatus.error, message=e.detail)
            self.raise_error(message=e.detail, code=e.code)

        return NodeResponse.model_validate(db_node)

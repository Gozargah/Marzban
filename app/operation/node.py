import asyncio
from datetime import datetime as dt

from sqlalchemy.exc import IntegrityError
from GozargahNodeBridge import GozargahNode, NodeAPIError

from app.operation import BaseOperation
from app.models.stats import NodeRealtimeStats, Period, NodeUsageStatsList, NodeStatsList
from app.models.node import NodeCreate, NodeResponse, NodeModify
from app.models.admin import AdminDetails
from app.db.models import Node, NodeStatus
from app.db import AsyncSession
from app.db.crud.node import (
    create_node,
    get_node_by_id,
    update_node_status,
    get_nodes,
    remove_node,
    get_nodes_usage,
    modify_node,
    get_node_stats,
)
from app.db.crud.user import get_user
from app.db.base import GetDB
from app.core.manager import core_manager
from app.node import core_users, node_manager
from app.utils.logger import get_logger
from app import notification


MAX_MESSAGE_LENGTH = 128

logger = get_logger("node-operation")


class NodeOperation(BaseOperation):
    async def get_db_nodes(
        self, db: AsyncSession, core_id: int | None = None, offset: int | None = None, limit: int | None = None
    ) -> list[Node]:
        return await get_nodes(db=db, core_id=core_id, offset=offset, limit=limit)

    @staticmethod
    async def update_node_status(
        node_id: int,
        status: NodeStatus,
        core_version: str = "",
        node_version: str = "",
        err: str = "",
        notify_err: bool = True,
    ):
        async with GetDB() as db:
            db_node = await get_node_by_id(db, node_id)

            if db_node is None:
                return

            old_status = db_node.status

            if status == NodeStatus.error:
                logger.error(f"Failed to connect node {db_node.name} with id {db_node.id}, Error: {err}")

            db_node = await update_node_status(
                db=db,
                db_node=db_node,
                status=status,
                xray_version=core_version,
                node_version=node_version,
                message=err,
            )

        node_response = NodeResponse.model_validate(db_node)
        if status is NodeStatus.connected:
            asyncio.create_task(notification.connect_node(node_response))

        if notify_err and status is NodeStatus.error and old_status is not NodeStatus.error:
            err = err[: MAX_MESSAGE_LENGTH - 3] + "..."
            asyncio.create_task(notification.error_node(node_response))

    @staticmethod
    async def connect_node(node_id: int) -> None:
        gozargah_node: GozargahNode | None = await node_manager.get_node(node_id)
        if gozargah_node is None:
            return

        async with GetDB() as db:
            db_node = await get_node_by_id(db, node_id)

            if db_node is None:
                return

            notify_err = True if db_node.status is not NodeStatus.error else False

            logger.info(f'Connecting to "{db_node.name}" node')
            await NodeOperation.update_node_status(db_node.id, NodeStatus.connecting)

            core = await core_manager.get_core(db_node.core_config_id if db_node.core_config_id else 1)

            try:
                info = await gozargah_node.start(
                    config=core.to_str(),
                    backend_type=0,
                    users=await core_users(db=db),
                    keep_alive=db_node.keep_alive,
                    ghather_logs=db_node.gather_logs,
                    timeout=10,
                )
                await NodeOperation.update_node_status(
                    node_id=db_node.id,
                    status=NodeStatus.connected,
                    core_version=info.core_version,
                    node_version=info.node_version,
                )
                logger.info(
                    f'Connected to "{db_node.name}" node v{info.node_version}, xray run on v{info.core_version}'
                )
            except NodeAPIError as e:
                if e.code == -4:
                    return

                detail = e.detail

                if len(detail) > 1024:
                    detail = detail[:1020] + "..."
                else:
                    detail = detail

                await NodeOperation.update_node_status(
                    node_id=db_node.id, status=NodeStatus.error, err=detail, notify_err=notify_err
                )

    async def create_node(self, db: AsyncSession, new_node: NodeCreate, admin: AdminDetails) -> NodeResponse:
        await self.get_validated_core_config(db, new_node.core_config_id)
        try:
            db_node = await create_node(db, new_node)
        except IntegrityError:
            await self.raise_error(message=f'Node "{new_node.name}" already exists', code=409, db=db)

        try:
            await node_manager.update_node(db_node)
            asyncio.create_task(self.connect_node(node_id=db_node.id))
        except NodeAPIError as e:
            await self.update_node_status(db_node.id, NodeStatus.error, err=e.detail)

        logger.info(f'New node "{db_node.name}" with id "{db_node.id}" added by admin "{admin.username}"')

        node = NodeResponse.model_validate(db_node)

        asyncio.create_task(notification.create_node(node, admin.username))

        return node

    async def modify_node(
        self, db: AsyncSession, node_id: Node, modified_node: NodeModify, admin: AdminDetails
    ) -> Node:
        db_node = await self.get_validated_node(db=db, node_id=node_id)
        if modified_node.core_config_id is not None:
            await self.get_validated_core_config(db, modified_node.core_config_id)

        try:
            db_node = await modify_node(db, db_node, modified_node)
        except IntegrityError:
            await self.raise_error(message=f'Node "{db_node.name}" already exists', code=409, db=db)

        if db_node.status is NodeStatus.disabled:
            await node_manager.remove_node(db_node.id)
        else:
            try:
                await node_manager.update_node(db_node)
                asyncio.create_task(self.connect_node(node_id=db_node.id))
            except NodeAPIError as e:
                await self.update_node_status(db_node.id, NodeStatus.error, err=e.detail)

        logger.info(f'Node "{db_node.name}" with id "{db_node.id}" modified by admin "{admin.username}"')

        node = NodeResponse.model_validate(db_node)

        asyncio.create_task(notification.modify_node(node, admin.username))

        return node

    async def remove_node(self, db: AsyncSession, node_id: Node, admin: AdminDetails) -> None:
        db_node: Node = await self.get_validated_node(db=db, node_id=node_id)

        await node_manager.remove_node(db_node.id)
        await remove_node(db=db, db_node=db_node)

        logger.info(f'Node "{db_node.name}" with id "{db_node.id}" deleted by admin "{admin.username}"')

        asyncio.create_task(notification.remove_node(db_node, admin.username))

    async def restart_node(self, node_id: Node, admin: AdminDetails) -> None:
        asyncio.create_task(self.connect_node(node_id))
        logger.info(f'Node "{node_id}" restarted by admin "{admin.username}"')

    async def restart_all_node(self, db: AsyncSession, core_id: int | None, admin: AdminDetails) -> None:
        nodes: list[Node] = await self.get_db_nodes(db, core_id)
        await asyncio.gather(*[NodeOperation.connect_node(node.id) for node in nodes])

        logger.info(f'All nodes restarted by admin "{admin.username}"')

    async def get_usage(
        self,
        db: AsyncSession,
        start: dt = None,
        end: dt = None,
        period: Period = Period.hour,
        node_id: int | None = None,
    ) -> NodeUsageStatsList:
        start, end = await self.validate_dates(start, end)
        return await get_nodes_usage(db, start, end, period=period, node_id=node_id)

    async def get_logs(self, node_id: Node) -> asyncio.Queue:
        node = await node_manager.get_node(node_id)

        if node is None:
            await self.raise_error(message="Node not found", code=404)

        try:
            logs_queue = await node.get_logs()
        except NodeAPIError as e:
            await self.raise_error(message=e.detail, code=e.code)

        return logs_queue

    async def get_node_stats_periodic(
        self, db: AsyncSession, node_id: id, start: dt = None, end: dt = None, period: Period = Period.hour
    ) -> NodeStatsList:
        start, end = await self.validate_dates(start, end)

        return await get_node_stats(db, node_id, start, end, period=period)

    async def get_node_system_stats(self, node_id: Node) -> NodeRealtimeStats:
        node = await node_manager.get_node(node_id)

        if node is None:
            await self.raise_error(message="Node not found", code=404)

        try:
            stats = await node.get_system_stats()
        except NodeAPIError as e:
            await self.raise_error(message=e.detail, code=e.code)

        if stats is None:
            await self.raise_error(message="Stats not found", code=404)

        return NodeRealtimeStats(
            mem_total=stats.mem_total,
            mem_used=stats.mem_used,
            cpu_cores=stats.cpu_cores,
            cpu_usage=stats.cpu_usage,
            incoming_bandwidth_speed=stats.incoming_bandwidth_speed,
            outgoing_bandwidth_speed=stats.outgoing_bandwidth_speed,
        )

    async def get_nodes_system_stats(self) -> dict[int, NodeRealtimeStats | None]:
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

    async def _get_node_stats_safe(self, node_id: Node) -> NodeRealtimeStats | None:
        """Wrapper method that returns None instead of raising exceptions"""
        try:
            return await self.get_node_system_stats(node_id)
        except Exception as e:
            logger.error(f"Error getting system stats for node {node_id}: {e}")
            return None

    async def get_user_online_stats_by_node(self, db: AsyncSession, node_id: Node, username: str) -> dict[int, int]:
        db_user = get_user(db, username=username)
        if db_user is None:
            await self.raise_error(message="User not found", code=404)

        node = await node_manager.get_node(node_id)

        if node is None:
            await self.raise_error(message="Node not found", code=404)

        try:
            stats = await node.get_user_online_stats(email=f"{db_user.id}.{db_user.username}")
        except NodeAPIError as e:
            await self.raise_error(message=e.detail, code=e.code)

        if stats is None:
            await self.raise_error(message="Stats not found", code=404)

        return {node_id: stats.value}

    async def get_user_ip_list_by_node(
        self, db: AsyncSession, node_id: Node, username: str
    ) -> dict[int, dict[str, int]]:
        db_user = get_user(db, username=username)
        if db_user is None:
            await self.raise_error(message="User not found", code=404)

        node = await node_manager.get_node(node_id)

        if node is None:
            await self.raise_error(message="Node not found", code=404)

        try:
            stats = await node.get_user_online_ip_list(email=f"{db_user.id}.{db_user.username}")
        except NodeAPIError as e:
            await self.raise_error(message=e.detail, code=e.code)

        if stats is None:
            await self.raise_error(message="Stats not found", code=404)

        return {node_id: stats.ips}

    async def sync_node_users(self, db: AsyncSession, node_id: int, flush_users: bool = False) -> NodeResponse:
        db_node = await self.get_validated_node(db, node_id=node_id)

        if db_node.status != NodeStatus.connected:
            await self.raise_error(message="Node is not connected", code=406)

        gozargah_node = await node_manager.get_node(node_id)
        if gozargah_node is None:
            await self.raise_error(message="Node is not connected", code=409)

        try:
            await gozargah_node.sync_users(await core_users(db=db), flush_queue=flush_users)
        except NodeAPIError as e:
            await update_node_status(db=db, db_node=db_node, status=NodeStatus.error, message=e.detail)
            await self.raise_error(message=e.detail, code=e.code)

        return NodeResponse.model_validate(db_node)

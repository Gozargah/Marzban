import asyncio
from datetime import datetime as dt
from typing import AsyncGenerator

from fastapi import APIRouter, Depends, Query, Request, status
from sse_starlette.sse import EventSourceResponse

from app.db import AsyncSession, get_db
from app.models.admin import AdminDetails
from app.models.node import NodeCreate, NodeModify, NodeResponse, NodeSettings, UsageTable
from app.models.stats import NodeRealtimeStats, NodeStatsList, NodeUsageStatsList, Period
from app.operation import OperatorType
from app.operation.node import NodeOperation
from app.utils import responses

from .authentication import check_sudo_admin

node_operator = NodeOperation(operator_type=OperatorType.API)
router = APIRouter(tags=["Node"], prefix="/api/node", responses={401: responses._401, 403: responses._403})


@router.get("/settings", response_model=NodeSettings)
async def get_node_settings(_: AdminDetails = Depends(check_sudo_admin)):
    """Retrieve the current node settings."""
    return NodeSettings()


@router.get("/usage", response_model=NodeUsageStatsList)
async def get_usage(
    db: AsyncSession = Depends(get_db),
    start: dt | None = Query(None, example="2024-01-01T00:00:00+03:30"),
    end: dt | None = Query(None, example="2024-01-31T23:59:59+03:30"),
    period: Period = Period.hour,
    node_id: int | None = None,
    group_by_node: bool = False,
    _: AdminDetails = Depends(check_sudo_admin),
):
    """Retrieve usage statistics for nodes within a specified date range."""
    return await node_operator.get_usage(
        db=db, start=start, end=end, period=period, node_id=node_id, group_by_node=group_by_node
    )


@router.get("s", response_model=list[NodeResponse])
async def get_nodes(
    backend_id: int | None = None,
    offset: int = None,
    limit: int = None,
    db: AsyncSession = Depends(get_db),
    _: AdminDetails = Depends(check_sudo_admin),
):
    """Retrieve a list of all nodes. Accessible only to sudo admins."""
    return await node_operator.get_db_nodes(db=db, core_id=backend_id, offset=offset, limit=limit)


@router.post(
    "",
    response_model=NodeResponse,
    responses={409: responses._409},
    status_code=status.HTTP_201_CREATED,
)
async def create_node(
    new_node: NodeCreate, db: AsyncSession = Depends(get_db), admin: AdminDetails = Depends(check_sudo_admin)
):
    """Create a new node to the database."""
    return await node_operator.create_node(db, new_node, admin)


@router.get("/{node_id}", response_model=NodeResponse)
async def get_node(node_id: int, db: AsyncSession = Depends(get_db), _: AdminDetails = Depends(check_sudo_admin)):
    """Retrieve details of a specific node by its ID."""
    return await node_operator.get_validated_node(db=db, node_id=node_id)


@router.put("/{node_id}", response_model=NodeResponse)
async def modify_node(
    modified_node: NodeModify,
    node_id: int,
    db: AsyncSession = Depends(get_db),
    admin: AdminDetails = Depends(check_sudo_admin),
):
    """Modify a node's details. Only accessible to sudo admins."""
    return await node_operator.modify_node(db, node_id=node_id, modified_node=modified_node, admin=admin)


@router.post("/{node_id}/reconnect")
async def reconnect_node(node_id: int, admin: AdminDetails = Depends(check_sudo_admin)):
    """Trigger a reconnection for the specified node. Only accessible to sudo admins."""
    await node_operator.restart_node(node_id=node_id, admin=admin)
    return {}


@router.put("/{node_id}/sync")
async def sync_node(
    node_id: int,
    flush_users: bool = False,
    db: AsyncSession = Depends(get_db),
    _: AdminDetails = Depends(check_sudo_admin),
):
    return await node_operator.sync_node_users(db, node_id=node_id, flush_users=flush_users)


@router.delete("/{node_id}", status_code=status.HTTP_204_NO_CONTENT)
async def remove_node(
    node_id: int, db: AsyncSession = Depends(get_db), admin: AdminDetails = Depends(check_sudo_admin)
):
    """Remove a node and remove it from xray in the background."""
    await node_operator.remove_node(db=db, node_id=node_id, admin=admin)
    return {}


@router.get("/{node_id}/logs")
async def node_logs(node_id: int, request: Request, _: AdminDetails = Depends(check_sudo_admin)):
    """
    Stream logs for a specific node as Server-Sent Events.
    """
    log_queue = await node_operator.get_logs(node_id=node_id)

    async def event_generator() -> AsyncGenerator[str, None]:
        try:
            while True:
                # Check if client disconnected
                if await request.is_disconnected():
                    break

                try:
                    log = await log_queue.get()
                    if log is None:
                        break
                    yield f"{log}"

                except Exception as e:
                    yield f"Error retrieving logs: {str(e)}\n"
                    break
        except asyncio.CancelledError:
            pass

    return EventSourceResponse(event_generator())


@router.get("/{node_id}/stats", response_model=NodeStatsList)
async def get_node_stats_periodic(
    node_id: int,
    start: dt | None = Query(None, example="2024-01-01T00:00:00+03:30"),
    end: dt | None = Query(None, example="2024-01-31T23:59:59+03:30"),
    period: Period = Period.hour,
    db: AsyncSession = Depends(get_db),
    _: AdminDetails = Depends(check_sudo_admin),
):
    return await node_operator.get_node_stats_periodic(db, node_id=node_id, start=start, end=end, period=period)


@router.get("/{node_id}/realtime_stats", response_model=NodeRealtimeStats)
async def realtime_node_stats(node_id: int, _: AdminDetails = Depends(check_sudo_admin)):
    """Retrieve node real-time statistics."""
    return await node_operator.get_node_system_stats(node_id=node_id)


@router.get("s/realtime_stats", response_model=dict[int, NodeRealtimeStats | None])
async def realtime_nodes_stats(_: AdminDetails = Depends(check_sudo_admin)):
    """Retrieve nodes real-time statistics."""
    return await node_operator.get_nodes_system_stats()


@router.get("/{node_id}/online_stats/{username}", response_model=dict[int, int])
async def user_online_stats(
    node_id: int, username: str, db: AsyncSession = Depends(get_db), _: AdminDetails = Depends(check_sudo_admin)
):
    """Retrieve user online stats by node."""
    return await node_operator.get_user_online_stats_by_node(db=db, node_id=node_id, username=username)


@router.get("/{node_id}/online_stats/{username}/ip", response_model=dict[int, dict[str, int]])
async def user_online_ip_list(
    node_id: int, username: str, db: AsyncSession = Depends(get_db), _: AdminDetails = Depends(check_sudo_admin)
):
    """Retrieve user ips by node."""
    return await node_operator.get_user_ip_list_by_node(db=db, node_id=node_id, username=username)


@router.delete(
    "s/clear_usage_data/{table}",
    summary="Clear usage data from a specified table",
)
async def clear_usage_data(
    table: UsageTable,
    start: dt | None = Query(None),
    end: dt | None = Query(None),
    db: AsyncSession = Depends(get_db),
    _: AdminDetails = Depends(check_sudo_admin),
):
    """
    Deletes **all rows** from the selected usage data table. Use with caution.

    Allowed tables:
        - `node_user_usages`: Deletes user-specific node usage traffic records.
        - `node_usages`: Deletes node-level aggregated traffic (uplink/downlink) records.

    **Optional filters:**
        - `start`: ISO 8601 timestamp to filter from (inclusive)
        - `end`: ISO 8601 timestamp to filter to (exclusive)

    ⚠️ This operation is irreversible. Ensure correct usage in production environments.
    """
    return await node_operator.clear_usage_data(db, table, start, end)

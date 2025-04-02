import asyncio
from typing import AsyncGenerator

from fastapi import APIRouter, Depends, Request, status
from sse_starlette.sse import EventSourceResponse

from app.db import AsyncSession, get_db
from app.models.admin import AdminDetails
from .authentication import check_sudo_admin
from app.models.stats import NodeStats, NodeUsageStats, Period
from app.models.node import NodeCreate, NodeModify, NodeResponse, NodeSettings
from app.operation.node import NodeOperator
from app.operation import OperatorType
from app.utils import responses


node_operator = NodeOperator(operator_type=OperatorType.API)
router = APIRouter(tags=["Node"], prefix="/api/node", responses={401: responses._401, 403: responses._403})


@router.get("/settings", response_model=NodeSettings)
async def get_node_settings(_: AdminDetails = Depends(check_sudo_admin)):
    """Retrieve the current node settings, including TLS certificate."""
    return await node_operator.get_node_settings()


@router.get("/{node_id}", response_model=NodeResponse)
async def get_node(node_id: int, db: AsyncSession = Depends(get_db), _: AdminDetails = Depends(check_sudo_admin)):
    """Retrieve details of a specific node by its ID."""
    return await node_operator.get_validated_node(db=db, node_id=node_id)


@router.get("s", response_model=list[NodeResponse])
async def get_nodes(
    offset: int = None,
    limit: int = None,
    db: AsyncSession = Depends(get_db),
    _: AdminDetails = Depends(check_sudo_admin),
):
    """Retrieve a list of all nodes. Accessible only to sudo admins."""
    return await node_operator.get_db_nodes(db=db, offset=offset, limit=limit)


@router.post(
    "",
    response_model=NodeResponse,
    responses={201: {"description": "Node created successfully"}, 409: responses._409},
    status_code=status.HTTP_201_CREATED,
)
async def add_node(
    new_node: NodeCreate, db: AsyncSession = Depends(get_db), admin: AdminDetails = Depends(check_sudo_admin)
):
    """Add a new node to the database."""
    return await node_operator.add_node(db, new_node, admin)


@router.put("/{node_id}", response_model=NodeResponse)
async def modify_node(
    modified_node: NodeModify,
    node_id: int,
    db: AsyncSession = Depends(get_db),
    admin: AdminDetails = Depends(check_sudo_admin),
):
    """Update a node's details. Only accessible to sudo admins."""
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


@router.delete("/{node_id}")
async def remove_node(
    node_id: int, db: AsyncSession = Depends(get_db), admin: AdminDetails = Depends(check_sudo_admin)
):
    """Delete a node and remove it from xray in the background."""
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


@router.get("/usage", response_model=list[NodeUsageStats])
async def get_usage(
    db: AsyncSession = Depends(get_db),
    start: str = "",
    end: str = "",
    period: Period = Period.hour,
    node_id: int | None = None,
    _: AdminDetails = Depends(check_sudo_admin),
):
    """Retrieve usage statistics for nodes within a specified date range."""
    return await node_operator.get_usage(db=db, start=start, end=end, period=period, node_id=node_id)


@router.get("/{node_id}/stats", response_model=NodeStats)
async def node_stats(node_id: int, _: AdminDetails = Depends(check_sudo_admin)):
    """Retrieve node real-time statistics."""
    return await node_operator.get_node_system_stats(node_id=node_id)


@router.get("s/stats", response_model=dict[int, NodeStats | None])
async def nodes_stats(_: AdminDetails = Depends(check_sudo_admin)):
    """Retrieve nodes real-time statistics."""
    return await node_operator.get_nodes_system_stats()


@router.get("/{node_id}/stats/{username}", response_model=dict[int, int])
async def user_online_stats(
    node_id: int, username: str, db: AsyncSession = Depends(get_db), _: AdminDetails = Depends(check_sudo_admin)
):
    """Retrieve user online stats by node."""
    return await node_operator.get_user_online_stats_by_node(db=db, node_id=node_id, username=username)


@router.get("/{node_id}/stats/{username}/ip", response_model=dict[int, dict[str, int]])
async def user_online_ip_list(
    node_id: int, username: str, db: AsyncSession = Depends(get_db), _: AdminDetails = Depends(check_sudo_admin)
):
    """Retrieve user ips by node."""
    return await node_operator.get_user_ip_list_by_node(db=db, node_id=node_id, username=username)

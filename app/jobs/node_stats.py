import asyncio

from GozargahNodeBridge import GozargahNode

from app import scheduler
from app.db import GetDB
from app.db.models import NodeStat
from app.node import node_manager
from app.utils.logger import get_logger
from config import ENABLE_RECORDING_NODES_STATS, JOB_GHATER_NODES_STATS_INTERVAL


logger = get_logger("jobs")


async def get_stat(id: int, node: GozargahNode) -> NodeStat:
    try:
        stats = await node.get_system_stats()
    except Exception:
        return

    if not stats:
        return

    return NodeStat(
        node_id=id,
        mem_total=stats.mem_total,
        mem_used=stats.mem_used,
        cpu_cores=stats.cpu_cores,
        cpu_usage=stats.cpu_usage,
        incoming_bandwidth_speed=stats.incoming_bandwidth_speed,
        outgoing_bandwidth_speed=stats.outgoing_bandwidth_speed,
    )


async def gather_nodes_stats():
    nodes = await node_manager.get_healthy_nodes()

    stats_list = await asyncio.gather(*[get_stat(id, node) for id, node in nodes])

    valid_stats = [stat for stat in stats_list if stat is not None]

    if valid_stats:
        async with GetDB() as db:
            db.add_all(valid_stats)
            await db.commit()


if ENABLE_RECORDING_NODES_STATS:
    scheduler.add_job(
        gather_nodes_stats, "interval", seconds=JOB_GHATER_NODES_STATS_INTERVAL, coalesce=True, max_instances=1
    )

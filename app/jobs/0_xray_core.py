import time
import traceback

from app import app, logger, scheduler, xray
from app.db import GetDB, crud
from app.models.node import NodeStatus
from app.utils.concurrency import threaded_function
from xray_api import exc as xray_exc

global _node_op_in_progress
_node_op_in_progress = {}


# ops = {node_id: (func, kwargs)}
@threaded_function
def _op(ops: dict):
    for node_id in list(ops.keys()):
        if _node_op_in_progress.get(node_id):
            del ops[node_id]
        else:
            _node_op_in_progress[node_id] = True

    if not ops:
        return

    config = xray.config.include_db_users()
    for node_id, (func, kwargs) in ops.items():
        func(config=config, **kwargs)
        try:
            del _node_op_in_progress[node_id]
        except KeyError:
            pass


def core_health_check():
    ops = {}

    # main core
    if not xray.core.started:
        ops[0] = (xray.core.restart, {})

    # nodes' core
    for node_id, node in list(xray.nodes.items()):
        if node.connected:
            try:
                node.api.get_sys_stats()
            except (ConnectionError, xray_exc.ConnectionError, xray_exc.UnknownError):
                ops[node_id] = (xray.operations.restart_node, {"node_id": node_id})

        if not node.connected:
            ops[node_id] = (xray.operations.connect_node, {"node_id": node_id})

    if ops:
        _op(ops)


@app.on_event("startup")
def start_core():
    logger.info("Generating Xray core config")

    start_time = time.time()
    config = xray.config.include_db_users()
    logger.info(f"Xray core config generated in {(time.time() - start_time):.2f} seconds")

    # main core
    logger.info("Starting main Xray core")
    try:
        xray.core.start(config)
    except Exception:
        traceback.print_exc()

    # nodes' core
    logger.info("Starting nodes Xray core")
    with GetDB() as db:
        dbnodes = crud.get_nodes(db=db, enabled=True)
        node_ids = [dbnode.id for dbnode in dbnodes]
        for dbnode in dbnodes:
            crud.update_node_status(db, dbnode, NodeStatus.connecting)

    for node_id in node_ids:
        xray.operations.connect_node(node_id, config)

    scheduler.add_job(core_health_check, 'interval', seconds=10, coalesce=True)


@app.on_event("shutdown")
def app_shutdown():
    logger.info("Stopping main Xray core")
    xray.core.stop()

    logger.info("Stopping nodes Xray core")
    for node in list(xray.nodes.values()):
        try:
            node.disconnect()
        except Exception:
            pass

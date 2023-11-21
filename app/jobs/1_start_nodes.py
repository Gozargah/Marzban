import json

from app import app, logger, scheduler, xray
from app.db import GetDB, crud
from app.models.node import NodeStatus
from app.utils.concurrency import threaded_function
from xray_api import exc as xray_exc


def nodes_health_check():
    config = None
    for node_id, node in list(xray.nodes.items()):
        if node.connected:
            try:
                node.api.get_sys_stats()
            except (ConnectionError, xray_exc.ConnectionError, xray_exc.UnknownError):
                if not config:
                    config = xray.config.include_db_users()
                xray.operations.restart_node(node_id, config)

        if not node.connected:
            if not config:
                config = xray.config.include_db_users()
            xray.operations.connect_node(node_id, config)


@app.on_event("startup")
@threaded_function
def app_startup():
    with GetDB() as db:
        dbnodes = crud.get_nodes(db=db, enabled=True)
        node_ids = [dbnode.id for dbnode in dbnodes]
        for dbnode in dbnodes:
            crud.update_node_status(db, dbnode, NodeStatus.connecting)

    config = xray.config.include_db_users()

    for node_id in node_ids:
        xray.operations.connect_node(node_id, config)

    scheduler.add_job(nodes_health_check, 'interval', seconds=20, coalesce=True, max_instances=1)


@app.on_event("shutdown")
def app_shutdown():
    for node in list(xray.nodes.values()):
        try:
            node.disconnect()
        except Exception:
            pass

from app import app, scheduler, xray
from app.db import GetDB, crud


@app.on_event("startup")
def app_startup():
    config = xray.config.include_db_users()

    with GetDB() as db:
        node_ids = [dbnode.id for dbnode in crud.get_nodes(db)]

    for node_id in node_ids:
        xray.operations.connect_node(node_id, config)


@app.on_event("shutdown")
def app_shutdown():
    for node in xray.nodes.values():
        try:
            node.disconnect()
        except Exception:
            pass


def reconnect_nodes():
    for node_id, node in xray.nodes.copy().items():
        if not node.connected:
            xray.operations.connect_node(node_id, xray.config.include_db_users())


scheduler.add_job(reconnect_nodes, 'interval', seconds=15)

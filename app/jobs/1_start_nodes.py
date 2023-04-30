from threading import Thread

from app import app, scheduler, xray
from app.db import GetDB, crud


@app.on_event("startup")
def app_startup():
    config = xray.config.include_db_users()

    with GetDB() as db:
        for dbnode in crud.get_nodes(db):
            Thread(target=xray.operations.connect_node, args=(dbnode.id, config)).start()


@app.on_event("shutdown")
def app_shutdown():
    for node in xray.nodes.values():
        try:
            node.disconnect()
        except Exception:
            pass


def reconnect_nodes():
    for node_id, node in xray.nodes.items():
        if not node.connected:
            Thread(target=xray.operations.connect_node, args=(
                node_id,
                xray.config.include_db_users()
            )).start()


scheduler.add_job(reconnect_nodes, 'interval', seconds=15)

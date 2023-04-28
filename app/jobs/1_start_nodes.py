from threading import Thread

from app import app, xray
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
            node.stop()
            node.disconnect()
        except Exception:
            pass

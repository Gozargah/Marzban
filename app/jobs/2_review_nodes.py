from threading import Thread
from app import logger, scheduler, xray

def review():
    config = xray.config.include_db_users()
    for nodeid, node in xray.nodes.items():
        try:
            if not node.connected:
                logger.info(f"\"{node.name}\" node is disconnected.")
                Thread(target=xray.operations.connect_node, args=(nodeid, config)).start()
        except Exception:
            pass

scheduler.add_job(review, 'interval', seconds=15)

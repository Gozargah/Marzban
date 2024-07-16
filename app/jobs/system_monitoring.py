from app import scheduler
from app.db import GetDB, crud
from app.models.node import NodeStatus
from config import NODE_MONITORING, EXLURED_NODE_MONITORING
from app.utils import report

def node_monitoring():
    if NODE_MONITORING:
        with GetDB() as db:
            nodes = crud.get_nodes(db, enabled=True, status=[NodeStatus.connecting, NodeStatus.error])
            for node in nodes:
                if node.name not in EXLURED_NODE_MONITORING:
                    report.node_error_monitoring(node)

scheduler.add_job(node_monitoring, 'interval', coalesce=True, seconds=10, max_instances=1)
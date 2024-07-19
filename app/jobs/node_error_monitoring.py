from app import scheduler 
from app.db import GetDB, crud 
from app.models.node import NodeStatus 
from config import NODE_MONITORING, EXLURED_NODE_MONITORING 
from app.utils import report 
from datetime import datetime, timedelta

last_alert_times = {}
ALERT_INTERVAL = timedelta(minutes=1)

def node_monitoring(): 
    if NODE_MONITORING: 
        with GetDB() as db: 
            nodes = crud.get_nodes(db, enabled=True, status=[NodeStatus.connecting, NodeStatus.error]) 
            current_time = datetime.now()
            for node in nodes: 
                if node.name not in EXLURED_NODE_MONITORING: 
                    if node.name not in last_alert_times or (current_time - last_alert_times[node.name]) >= ALERT_INTERVAL:
                        report.node_error_monitoring(node)
                        last_alert_times[node.name] = current_time
  
scheduler.add_job(node_monitoring, 'interval', coalesce=True, seconds=10, max_instances=1)
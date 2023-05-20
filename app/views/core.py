import asyncio
import json
import re

from fastapi import Depends, HTTPException, WebSocket

from app import app, xray
from app.db import Session, get_db, crud
from app.models.admin import Admin
from app.models.core import CoreStats
from app.xray import XRayConfig
from config import XRAY_JSON


@app.websocket("/api/core/logs")
async def core_logs(websocket: WebSocket, db: Session = Depends(get_db)):
    token = (
        websocket.query_params.get('token')
        or
        websocket.headers.get('Authorization', '').removeprefix("Bearer ")
    )
    admin = Admin.get_admin(token, db)
    if not admin:
        return await websocket.close(reason="Unauthorized", code=4401)

    if not admin.is_sudo:
        return await websocket.close(reason="You're not allowed", code=1008)

    core_only = websocket.query_params.get('logs') == 'core_only'
    await websocket.accept()
    if not core_only:
        nodes = crud.get_nodes(db)
        with xray.core.get_logs() as logs:
            while True:
                for node in nodes:
                    nodeapi = xray.nodes[node.id]
                    logs_tail = nodeapi.remote.fetch_logs()
                    if not logs_tail:
                        await asyncio.sleep(0.2)
                        continue

                    logs = logs_tail.splitlines()
                    for log in logs:
                        try:
                            await websocket.send_text(log)
                        except:
                            break

                if not logs:
                    await asyncio.sleep(0.2)
                    continue

                log = logs.popleft()
                try:
                    await websocket.send_text(log)
                except:
                    break
    else:
        with xray.core.get_logs() as logs:
            while True:
                if not logs:
                    await asyncio.sleep(0.2)
                    continue

                log = logs.popleft()
                try:
                    await websocket.send_text(log)
                except:
                    break


@app.get("/api/core", tags=["Core"], response_model=CoreStats)
def get_core_stats(admin: Admin = Depends(Admin.get_current)):
    return CoreStats(
        version=xray.core.version,
        started=xray.core.started,
        logs_websocket=app.url_path_for('core_logs')
    )


@app.post("/api/core/restart", tags=["Core"])
def restart_core(admin: Admin = Depends(Admin.get_current)):
    if not admin.is_sudo:
        raise HTTPException(status_code=403, detail="You're not allowed")

    xray.core.restart(xray.config.include_db_users())
    return {}


@app.get("/api/core/config", tags=["Core"])
def get_core_config(admin: Admin = Depends(Admin.get_current)) -> dict:
    if not admin.is_sudo:
        raise HTTPException(status_code=403, detail="You're not allowed")

    with open(XRAY_JSON, "r") as f:
        jdata = re.sub(r'//.*|/\*[\s\S]*?\*/', '', f.read())
        config = json.loads(jdata)

    return config


@app.put("/api/core/config", tags=["Core"])
def get_core_config(payload: dict, admin: Admin = Depends(Admin.get_current)) -> dict:
    if not admin.is_sudo:
        raise HTTPException(status_code=403, detail="You're not allowed")

    try:
        config = XRayConfig(payload, api_port=xray.config.api_port)
    except ValueError as err:
        raise HTTPException(status_code=400, detail=str(err))

    xray.config = config
    xray.core.restart(xray.config.include_db_users())
    for node_id, node in xray.nodes.items():
        if node.connected:
            xray.operations.restart_node(node_id, xray.config.include_db_users())

    xray.hosts.update()

    with open(XRAY_JSON, 'w') as f:
        f.write(json.dumps(payload, indent=4))

    return payload

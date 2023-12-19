import asyncio
import json
import time

import commentjson
from fastapi import Depends, HTTPException, WebSocket
from starlette.websockets import WebSocketDisconnect

from app import app, xray
from app.db import Session, get_db
from app.models.admin import Admin
from app.models.core import CoreStats
from app.xray import XRayConfig
from config import XRAY_JSON
from anyio import create_memory_object_stream, run


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
        return await websocket.close(reason="You're not allowed", code=4403)

    interval = websocket.query_params.get('interval')
    if interval:
        try:
            interval = float(interval)
        except ValueError:
            return await websocket.close(reason="Invalid interval value", code=4400)
        if interval > 10:
            return await websocket.close(reason="Interval must be more than 0 and at most 10 seconds", code=4400)

    await websocket.accept()

    try:
        buffer = xray.core.get_buffer()
        while buffer:
            await websocket.send_text(buffer.popleft().decode("utf-8"))
        while l := await (await xray.core.get_logs_stm()).receive():
            l = l.decode("utf-8")
            await websocket.send_text(l)
    except (WebSocketDisconnect, RuntimeError):
        pass
    except asyncio.CancelledError:
        await websocket.close()
    except:
        pass


@app.get("/api/core", tags=["Core"], response_model=CoreStats)
def get_core_stats(admin: Admin = Depends(Admin.get_current)):
    return CoreStats(
        version=xray.core.version,
        started=xray.core.started,
        logs_websocket=app.url_path_for('core_logs')
    )


@app.post("/api/core/restart", tags=["Core"])
async def restart_core(admin: Admin = Depends(Admin.get_current)):
    if not admin.is_sudo:
        raise HTTPException(status_code=403, detail="You're not allowed")

    startup_config = xray.config.include_db_users()
    await xray.core.restart(startup_config)
    for node_id, node in list(xray.nodes.items()):
        if node.connected:
            xray.operations.restart_node(node_id, startup_config)
    return {}


@app.get("/api/core/config", tags=["Core"])
def get_core_config(admin: Admin = Depends(Admin.get_current)) -> dict:
    if not admin.is_sudo:
        raise HTTPException(status_code=403, detail="You're not allowed")

    with open(XRAY_JSON, "r") as f:
        config = commentjson.loads(f.read())

    return config


@app.put("/api/core/config", tags=["Core"])
async def modify_core_config(payload: dict, admin: Admin = Depends(Admin.get_current)) -> dict:
    if not admin.is_sudo:
        raise HTTPException(status_code=403, detail="You're not allowed")

    try:
        config = XRayConfig(payload, api_port=xray.config.api_port)
    except ValueError as err:
        raise HTTPException(status_code=400, detail=str(err))

    xray.config = config
    startup_config = xray.config.include_db_users()
    await xray.core.restart(startup_config)
    for node_id, node in list(xray.nodes.items()):
        if node.connected:
            xray.operations.restart_node(node_id, startup_config)

    xray.hosts.update()

    with open(XRAY_JSON, 'w') as f:
        f.write(json.dumps(payload, indent=4))

    return payload

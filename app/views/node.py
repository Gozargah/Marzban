import asyncio
import time
from datetime import datetime
from typing import List

import sqlalchemy
from fastapi import BackgroundTasks, Depends, HTTPException, WebSocket
from starlette.websockets import WebSocketDisconnect

from app import app, logger, xray
from app.db import Session, crud, get_db
from app.models.admin import Admin
from app.models.node import (NodeCreate, NodeModify, NodeResponse,
                             NodeSettings, NodeStatus, NodesUsageResponse)
from app.models.proxy import ProxyHost


@app.get("/api/node/settings", tags=['Node'], response_model=NodeSettings)
def get_node_settings(db: Session = Depends(get_db),
                      admin: Admin = Depends(Admin.get_current)):
    if not admin.is_sudo:
        raise HTTPException(status_code=403, detail="You're not allowed")

    tls = crud.get_tls_certificate(db)

    return NodeSettings(
        certificate=tls.certificate
    )


@app.post("/api/node", tags=['Node'], response_model=NodeResponse)
def add_node(new_node: NodeCreate,
             bg: BackgroundTasks,
             db: Session = Depends(get_db),
             admin: Admin = Depends(Admin.get_current)):

    if not admin.is_sudo:
        raise HTTPException(status_code=403, detail="You're not allowed")

    try:
        dbnode = crud.create_node(db, new_node)
    except sqlalchemy.exc.IntegrityError:
        db.rollback()
        raise HTTPException(status_code=409, detail=f"Node \"{new_node.name}\" already exists")

    bg.add_task(
        xray.operations.connect_node,
        node_id=dbnode.id
    )

    if new_node.add_as_new_host is True:
        host = ProxyHost(
            remark=(new_node.name + " ({USERNAME}) [{PROTOCOL} - {TRANSPORT}]"),
            address=new_node.address
        )
        for inbound_tag in xray.config.inbounds_by_tag:
            crud.add_host(db, inbound_tag, host)

        xray.hosts.update()

    logger.info(f"New node \"{dbnode.name}\" added")
    return dbnode


@app.get("/api/node/{node_id}", tags=['Node'], response_model=NodeResponse)
def get_node(node_id: int,
             db: Session = Depends(get_db),
             admin: Admin = Depends(Admin.get_current)):
    if not admin.is_sudo:
        raise HTTPException(status_code=403, detail="You're not allowed")

    dbnode = crud.get_node_by_id(db, node_id)
    if not dbnode:
        raise HTTPException(status_code=404, detail="Node not found")

    return dbnode


@app.websocket("/api/node/{node_id}/logs")
async def node_logs(node_id: int, websocket: WebSocket, db: Session = Depends(get_db)):
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

    if not xray.nodes.get(node_id):
        return await websocket.close(reason="Node not found", code=4404)

    if not xray.nodes[node_id].connected:
        return await websocket.close(reason="Node is not connected", code=4400)

    interval = websocket.query_params.get('interval')
    if interval:
        try:
            interval = float(interval)
        except ValueError:
            return await websocket.close(reason="Invalid interval value", code=4400)
        if interval > 10:
            return await websocket.close(reason="Interval must be more than 0 and at most 10 seconds", code=4400)

    await websocket.accept()

    cache = ''
    last_sent_ts = 0
    node = xray.nodes[node_id]
    with node.get_logs() as logs:
        while True:
            if not node == xray.nodes[node_id]:
                break

            if interval and time.time() - last_sent_ts >= interval and cache:
                try:
                    await websocket.send_text(cache)
                except (WebSocketDisconnect, RuntimeError):
                    break
                cache = ''
                last_sent_ts = time.time()

            if not logs:
                try:
                    await asyncio.wait_for(websocket.receive(), timeout=0.2)
                    continue
                except asyncio.TimeoutError:
                    continue
                except (WebSocketDisconnect, RuntimeError):
                    break

            log = logs.popleft()

            if interval:
                cache += f'{log}\n'
                continue

            try:
                await websocket.send_text(log)
            except (WebSocketDisconnect, RuntimeError):
                break


@app.get("/api/nodes", tags=['Node'], response_model=List[NodeResponse])
def get_nodes(db: Session = Depends(get_db),
              admin: Admin = Depends(Admin.get_current)):
    if not admin.is_sudo:
        raise HTTPException(status_code=403, detail="You're not allowed")
    return crud.get_nodes(db)


@app.put("/api/node/{node_id}", tags=['Node'], response_model=NodeResponse)
def modify_node(node_id: int,
                modified_node: NodeModify,
                bg: BackgroundTasks,
                db: Session = Depends(get_db),
                admin: Admin = Depends(Admin.get_current)):

    if not admin.is_sudo:
        raise HTTPException(status_code=403, detail="You're not allowed")

    dbnode = crud.get_node_by_id(db, node_id)
    if not dbnode:
        raise HTTPException(status_code=404, detail="Node not found")

    dbnode = crud.update_node(db, dbnode, modified_node)

    xray.operations.remove_node(dbnode.id)
    if dbnode.status != NodeStatus.disabled:
        bg.add_task(
            xray.operations.connect_node,
            node_id=dbnode.id
        )

    logger.info(f"Node \"{dbnode.name}\" modified")
    return dbnode


@app.post("/api/node/{node_id}/reconnect", tags=['Node'])
def reconnect_node(node_id: int,
                   bg: BackgroundTasks,
                   db: Session = Depends(get_db),
                   admin: Admin = Depends(Admin.get_current)):

    if not admin.is_sudo:
        raise HTTPException(status_code=403, detail="You're not allowed")

    dbnode = crud.get_node_by_id(db, node_id)
    if not dbnode:
        raise HTTPException(status_code=404, detail="Node not found")
    bg.add_task(
        xray.operations.connect_node,
        node_id=dbnode.id
    )
    return {}


@app.delete("/api/node/{node_id}", tags=['Node'])
def remove_node(node_id: int,
                db: Session = Depends(get_db),
                admin: Admin = Depends(Admin.get_current)):

    if not admin.is_sudo:
        raise HTTPException(status_code=403, detail="You're not allowed")

    dbnode = crud.get_node_by_id(db, node_id)
    if not dbnode:
        raise HTTPException(status_code=404, detail="Node not found")

    crud.remove_node(db, dbnode)
    xray.operations.remove_node(dbnode.id)

    logger.info(f"Node \"{dbnode.name}\" deleted")
    return {}


@app.get("/api/nodes/usage", tags=['Node'], response_model=NodesUsageResponse)
def get_usage(db: Session = Depends(get_db),
              start: str = None,
              end: str = None,
              admin: Admin = Depends(Admin.get_current)):
    """
    Get nodes usage
    """

    if not admin.is_sudo:
        raise HTTPException(status_code=403, detail="You're not allowed")

    if start is None:
        start_date = datetime.fromtimestamp(datetime.utcnow().timestamp() - 30 * 24 * 3600)
    else:
        start_date = datetime.fromisoformat(start)

    if end is None:
        end_date = datetime.utcnow()
    else:
        end_date = datetime.fromisoformat(end)

    usages = crud.get_nodes_usage(db, start_date, end_date)

    return {"usages": usages}

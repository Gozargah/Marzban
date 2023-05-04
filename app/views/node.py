from typing import List

import sqlalchemy
from fastapi import BackgroundTasks, Depends, HTTPException

from app import app, logger, xray
from app.db import Session, crud, get_db
from app.models.admin import Admin
from app.models.node import NodeCreate, NodeModify, NodeResponse, NodesUsageResponse
from app.models.proxy import ProxyHost


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
        raise HTTPException(status_code=409, detail=f"Node \"{new_node.name}\" already exists")

    xray.operations.add_node(dbnode)
    bg.add_task(xray.operations.connect_node,
                node_id=dbnode.id,
                config=xray.config.include_db_users())

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

    dbnode = crud.get_node_by_id(db, node_id)
    if not dbnode:
        raise HTTPException(status_code=404, detail="Node not found")

    return dbnode


@app.get("/api/nodes", tags=['Node'], response_model=List[NodeResponse])
def get_nodes(db: Session = Depends(get_db),
              admin: Admin = Depends(Admin.get_current)):

    return crud.get_nodes(db)

@app.post("/api/node/{node_id}/reset", tags=['Node'])
def reset_node_usage(node_id: int,
                     db: Session = Depends(get_db),
                     admin: Admin = Depends(Admin.get_current)):
    
    if not admin.is_sudo:
        raise HTTPException(status_code=403, detail="You're not allowed")

    dbnode = crud.get_node_by_id(db, node_id)
    if not dbnode:
        raise HTTPException(status_code=404, detail="Node not found")
    
    crud.reset_node_usage(db=db, dbnode=dbnode)
    return {}

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
    xray.operations.add_node(dbnode)
    bg.add_task(xray.operations.connect_node,
                node_id=dbnode.id,
                config=xray.config.include_db_users())

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

    bg.add_task(xray.operations.connect_node,
                node_id=dbnode.id,
                config=xray.config.include_db_users())
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
def get_user(db: Session = Depends(get_db),
             admin: Admin = Depends(Admin.get_current)):
    """
    Get nodes usage
    """

    usages = crud.get_nodes_usage(db)

    return {"usages": usages}
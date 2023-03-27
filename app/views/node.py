from datetime import datetime
from typing import List

import sqlalchemy
from fastapi import BackgroundTasks, Depends, HTTPException

from app import app, logger, telegram, xray
from app.db import Session, crud, get_db
from app.models.admin import Admin
from app.models.node import NodeCreate, NodeModify, NodeResponse, NodeStatus
from app.models.user import (UserCreate, UserModify, UserResponse,
                             UsersResponse, UserStatus)


@app.post("/api/node", tags=['Node'], response_model=NodeResponse)
def add_user(new_node: NodeCreate,
             db: Session = Depends(get_db),
             admin: Admin = Depends(Admin.get_current)):

    if not admin.is_sudo:
        raise HTTPException(status_code=403, detail="You're not allowed")

    try:
        dbnode = crud.create_node(db, new_node)
    except sqlalchemy.exc.IntegrityError:
        raise HTTPException(status_code=409, detail=f"Node \"{new_node.name}\" already exists")

    logger.info(f"New node \"{dbnode.name}\" added")
    return dbnode


@app.get("/api/node/{node_id}", tags=['Node'], response_model=NodeResponse)
def get_user(node_id: int,
             db: Session = Depends(get_db),
             admin: Admin = Depends(Admin.get_current)):

    dbnode = crud.get_node_by_id(db, node_id)
    if not dbnode:
        raise HTTPException(status_code=404, detail="Node not found")

    return dbnode


@app.put("/api/node/{node_id}", tags=['Node'], response_model=NodeResponse)
def modify_user(node_id: int,
                modified_node: NodeModify,
                db: Session = Depends(get_db),
                admin: Admin = Depends(Admin.get_current)):

    if not admin.is_sudo:
        raise HTTPException(status_code=403, detail="You're not allowed")

    dbnode = crud.get_node_by_id(db, node_id)
    if not dbnode:
        raise HTTPException(status_code=404, detail="Node not found")

    dbnode = crud.update_node(db, dbnode, modified_node)

    logger.info(f"Node \"{dbnode.name}\" modified")
    return dbnode


@app.delete("/api/node/{node_id}", tags=['Node'])
def remove_user(node_id: int,
                db: Session = Depends(get_db),
                admin: Admin = Depends(Admin.get_current)):

    if not admin.is_sudo:
        raise HTTPException(status_code=403, detail="You're not allowed")

    dbnode = crud.get_node_by_id(db, node_id)
    if not dbnode:
        raise HTTPException(status_code=404, detail="Node not found")

    crud.remove_node(db, dbnode)

    logger.info(f"Node \"{dbnode.name}\" deleted")
    return {}

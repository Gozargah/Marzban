import re
from datetime import datetime
from typing import List

import sqlalchemy
from app import app, jwt, logger, xray
from app.db import Session, crud, get_db
from app.models.admin import Admin
from app.models.user import UserCreate, UserModify, UserResponse, UserStatus
from app.xray import INBOUND_TAGS
from fastapi import Depends, HTTPException

USERNAME_REGEXP = re.compile(r'^(?=\w{3,32}\b)[a-zA-Z0-9]+(?:_[a-zA-Z0-9]+)*$')


@app.post("/user", tags=['User'], response_model=UserResponse)
def add_user(new_user: UserCreate,
             db: Session = Depends(get_db),
             admin: Admin = Depends(jwt.current_user)):
    """
    Add a new user

    - **username** must have 3 to 32 characters and is allowed to contain a-z, 0-9, and underscores in between
    - **expire** must be an UTC timestamp
    - **data_limit** must be in Bytes, e.g. 1073741824B = 1GB
    - **proxy_type** vmess, vless, trojan or shadowsocks
    """

    if not USERNAME_REGEXP.match(new_user.username):
        raise HTTPException(
            status_code=400,
            detail="Username only can be 3 to 32 characters and contain a-z, 0-9, and underscores in between.")

    try:
        inbound = INBOUND_TAGS[new_user.proxy_type]
    except KeyError:
        raise HTTPException(status_code=400, detail=f"Proxy type {new_user.proxy_type} not supported")

    try:
        dbuser = crud.create_user(db, new_user)
    except sqlalchemy.exc.IntegrityError:
        raise HTTPException(status_code=409, detail="User already exists.")

    account = new_user.get_account()

    try:
        xray.api.add_inbound_user(tag=inbound, user=account)
    except xray.exc.EmailExistsError:
        pass

    logger.info(f"New user \"{dbuser.username}\" added")
    return dbuser


@app.get("/user/{username}", tags=['User'], response_model=UserResponse)
def get_user(username: str,
             db: Session = Depends(get_db),
             admin: Admin = Depends(jwt.current_user)):
    """
    Get users information
    """
    dbuser = crud.get_user(db, username)
    if not dbuser:
        raise HTTPException(status_code=404, detail="User not found")

    return dbuser


@app.put("/user/{username}", tags=['User'], response_model=UserResponse)
def modify_user(username: str,
                modified_user: UserModify,
                db: Session = Depends(get_db),
                admin: Admin = Depends(jwt.current_user)):
    """
    Modify a user

    - set **expire** to 0 to make the user unlimited in time
    - set **data_limit** to 0 to make the user unlimited in data
    - **settings** depends on what type of proxy user have
    - **proxy_type** must be specified when settings field is set
    """

    dbuser = crud.get_user(db, username)
    if not dbuser:
        raise HTTPException(status_code=404, detail="User not found")

    dbuser = crud.update_user(db, dbuser, modified_user)

    if modified_user.expire is not None and dbuser.status != UserStatus.limited:
        if not dbuser.expire or dbuser.expire > datetime.utcnow().timestamp():
            dbuser = crud.update_user_status(db, dbuser, UserStatus.active)
        else:
            dbuser = crud.update_user_status(db, dbuser, UserStatus.expired)

    if modified_user.data_limit is not None and dbuser.status != UserStatus.expired:
        if not dbuser.data_limit or dbuser.used_traffic < dbuser.data_limit:
            dbuser = crud.update_user_status(db, dbuser, UserStatus.active)
        else:
            dbuser = crud.update_user_status(db, dbuser, UserStatus.limited)

    user = UserResponse.from_orm(dbuser)
    inbound = INBOUND_TAGS[user.proxy_type]
    account = user.get_account()

    try:
        xray.api.remove_inbound_user(tag=inbound, email=username)
    except xray.exc.EmailNotFoundError:
        pass

    if user.status == UserStatus.active:
        xray.api.add_inbound_user(tag=inbound, user=account)

    logger.info(f"User \"{user.username}\" modified")
    return user


@app.delete("/user/{username}", tags=['User'])
def remove_user(username: str,
                db: Session = Depends(get_db),
                admin: Admin = Depends(jwt.current_user)):
    """
    Remove a user
    """

    dbuser = crud.get_user(db, username)
    if not dbuser:
        raise HTTPException(status_code=404, detail="User not found")

    inbound = INBOUND_TAGS[dbuser.proxy_type]
    crud.remove_user(db, dbuser)

    try:
        xray.api.remove_inbound_user(tag=inbound, email=username)
    except xray.exc.EmailNotFoundError:
        pass

    logger.info(f"User \"{username}\" deleted")
    return {}


@app.get("/users", tags=['User'], response_model=List[UserResponse])
def get_users(offset: int = None,
              limit: int = None,
              db: Session = Depends(get_db),
              admin: Admin = Depends(jwt.current_user)):
    """
    Get all users
    """

    return crud.get_users(db, offset, limit)

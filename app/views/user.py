from datetime import datetime
from typing import List

import sqlalchemy
from app import app, logger, xray
from app.db import Session, crud, get_db
from app.models.admin import Admin
from app.models.user import UserCreate, UserModify, UserResponse, UserStatus
from app.utils.jwt import current_admin
from app.xray import INBOUNDS
from fastapi import Depends, HTTPException


@app.post("/api/user", tags=['User'], response_model=UserResponse)
def add_user(new_user: UserCreate,
             db: Session = Depends(get_db),
             admin: Admin = Depends(current_admin)):
    """
    Add a new user

    - **username** must have 3 to 32 characters and is allowed to contain a-z, 0-9, and underscores in between
    - **expire** must be an UTC timestamp
    - **data_limit** must be in Bytes, e.g. 1073741824B = 1GB
    - **proxies** a dictionary of proxies, supported proxies: vmess, vless, trojan or shadowsocks
    """
    # TODO expire should be datetime instead of timestamp

    try:
        [INBOUNDS[t] for t in new_user.proxies]
    except KeyError as exc:
        raise HTTPException(status_code=400, detail=f"Proxy type {exc.args[0]} not supported")

    try:
        dbuser = crud.create_user(db, new_user)
    except sqlalchemy.exc.IntegrityError:
        raise HTTPException(status_code=409, detail="User already exists.")

    for proxy_type in new_user.proxies:
        account = new_user.get_account(proxy_type)
        for inbound in INBOUNDS[proxy_type]:
            try:
                xray.api.add_inbound_user(tag=inbound['tag'], user=account)
            except xray.exc.EmailExistsError:
                pass

    logger.info(f"New user \"{dbuser.username}\" added")
    return dbuser


@app.get("/api/user/{username}", tags=['User'], response_model=UserResponse)
def get_user(username: str,
             db: Session = Depends(get_db),
             admin: Admin = Depends(current_admin)):
    """
    Get users information
    """
    dbuser = crud.get_user(db, username)
    if not dbuser:
        raise HTTPException(status_code=404, detail="User not found")

    return dbuser


@app.put("/api/user/{username}", tags=['User'], response_model=UserResponse)
def modify_user(username: str,
                modified_user: UserModify,
                db: Session = Depends(get_db),
                admin: Admin = Depends(current_admin)):
    """
    Modify a user

    - set **expire** to 0 to make the user unlimited in time
    - set **data_limit** to 0 to make the user unlimited in data
    - **proxies** a dictionary of proxies, supported proxies: vmess, vless, trojan or shadowsocks
    """

    try:
        [INBOUNDS[t] for t in modified_user.proxies]
    except KeyError as exc:
        raise HTTPException(status_code=400, detail=f"Proxy type {exc.args[0]} not supported")

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

    for proxy_type in user.proxies:
        account = user.get_account(proxy_type)
        for inbound in INBOUNDS[proxy_type]:
            try:
                xray.api.remove_inbound_user(tag=inbound['tag'], email=user.username)
            except xray.exc.EmailNotFoundError:
                pass

            if user.status == UserStatus.active:
                xray.api.add_inbound_user(tag=inbound['tag'], user=account)

    logger.info(f"User \"{user.username}\" modified")
    return user


@app.delete("/api/user/{username}", tags=['User'])
def remove_user(username: str,
                db: Session = Depends(get_db),
                admin: Admin = Depends(current_admin)):
    """
    Remove a user
    """

    dbuser = crud.get_user(db, username)
    if not dbuser:
        raise HTTPException(status_code=404, detail="User not found")

    crud.remove_user(db, dbuser)
    for proxy in dbuser.proxies:
        for inbound in INBOUNDS[proxy.type]:
            try:
                xray.api.remove_inbound_user(tag=inbound['tag'], email=username)
            except xray.exc.EmailNotFoundError:
                pass

    logger.info(f"User \"{username}\" deleted")
    return {}


@app.get("/api/users", tags=['User'], response_model=List[UserResponse])
def get_users(offset: int = None,
              limit: int = None,
              username: str = None,
              status: UserStatus = None,
              db: Session = Depends(get_db),
              admin: Admin = Depends(current_admin)):
    """
    Get all users
    """

    return crud.get_users(db, offset, limit, username, status)

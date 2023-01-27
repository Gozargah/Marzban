from datetime import datetime
from typing import List

import sqlalchemy
from app import app, logger, telegram, xray
from app.db import Session, crud, get_db
from app.models.admin import Admin
from app.models.proxy import ProxyTypes
from app.models.user import UserCreate, UserModify, UserResponse, UserStatus
from app.xray import INBOUNDS
from fastapi import BackgroundTasks, Depends, HTTPException


@app.post("/api/user", tags=['User'], response_model=UserResponse)
def add_user(new_user: UserCreate,
             bg: BackgroundTasks,
             db: Session = Depends(get_db),
             admin: Admin = Depends(Admin.get_current)):
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
        raise HTTPException(status_code=400, detail=f"Protocol {exc.args[0]} is disabled on your server")

    try:
        if admin.is_sudo:
            dbuser = crud.create_user(db, new_user)
        else:
            dbuser = crud.create_user(db, new_user,
                                      admin=crud.get_admin(db, admin.username))
    except sqlalchemy.exc.IntegrityError:
        raise HTTPException(status_code=409, detail="User already exists")

    for proxy_type in new_user.proxies:
        account = new_user.get_account(proxy_type)
        for inbound in INBOUNDS.get(proxy_type, []):
            try:
                xray.api.add_inbound_user(tag=inbound['tag'], user=account)
            except xray.exc.EmailExistsError:
                pass

    bg.add_task(
        telegram.report_new_user,
        username=dbuser.username,
        by=admin.username
    )
    logger.info(f"New user \"{dbuser.username}\" added")
    return dbuser


@ app.get("/api/user/{username}", tags=['User'], response_model=UserResponse)
def get_user(username: str,
             db: Session = Depends(get_db),
             admin: Admin = Depends(Admin.get_current)):
    """
    Get users information
    """
    dbuser = crud.get_user(db, username)
    if not dbuser:
        raise HTTPException(status_code=404, detail="User not found")

    if not (admin.is_sudo or (dbuser.admin and dbuser.admin.username == admin.username)):
        raise HTTPException(status_code=403, detail="You're not allowed")

    return dbuser


@ app.put("/api/user/{username}", tags=['User'], response_model=UserResponse)
def modify_user(username: str,
                modified_user: UserModify,
                bg: BackgroundTasks,
                db: Session = Depends(get_db),
                admin: Admin = Depends(Admin.get_current)):
    """
    Modify a user

    - set **expire** to 0 to make the user unlimited in time
    - set **data_limit** to 0 to make the user unlimited in data
    - **proxies** a dictionary of proxies, supported proxies: vmess, vless, trojan or shadowsocks
    """

    try:
        [INBOUNDS[t] for t in modified_user.proxies]
    except KeyError as exc:
        raise HTTPException(status_code=400, detail=f"Protocol {exc.args[0]} is disabled on your server")

    dbuser = crud.get_user(db, username)
    if not dbuser:
        raise HTTPException(status_code=404, detail="User not found")

    if not (admin.is_sudo or (dbuser.admin and dbuser.admin.username == admin.username)):
        raise HTTPException(status_code=403, detail="You're not allowed")

    dbuser = crud.update_user(db, dbuser, modified_user)

    if modified_user.expire is not None and dbuser.status != UserStatus.limited:
        if not dbuser.expire or dbuser.expire > datetime.utcnow().timestamp():
            status = UserStatus.active
        else:
            status = UserStatus.expired
        dbuser = crud.update_user_status(db, dbuser, status)

        bg.add_task(
            telegram.report_status_change,
            username=dbuser.username,
            status=status
        )
        logger.info(f"User \"{dbuser.username}\" status changed to {status}")

    if modified_user.data_limit is not None and dbuser.status != UserStatus.expired:
        if not dbuser.data_limit or dbuser.used_traffic < dbuser.data_limit:
            status = UserStatus.active
        else:
            status = UserStatus.limited
        dbuser = crud.update_user_status(db, dbuser, status)

        bg.add_task(
            telegram.report_status_change,
            username=dbuser.username,
            status=status
        )
        logger.info(f"User \"{dbuser.username}\" status changed to {status}")

    user = UserResponse.from_orm(dbuser)

    for proxy_type in ProxyTypes:
        for inbound in INBOUNDS.get(proxy_type, []):
            try:
                xray.api.remove_inbound_user(tag=inbound['tag'], email=user.username)
            except xray.exc.EmailNotFoundError:
                pass
            if proxy_type in user.proxies and user.status == UserStatus.active:
                account = user.get_account(proxy_type)
                xray.api.add_inbound_user(tag=inbound['tag'], user=account)

    bg.add_task(
        telegram.report_user_modification,
        username=dbuser.username,
        by=admin.username
    )
    logger.info(f"User \"{user.username}\" modified")
    return user


@ app.delete("/api/user/{username}", tags=['User'])
def remove_user(username: str,
                bg: BackgroundTasks,
                db: Session = Depends(get_db),
                admin: Admin = Depends(Admin.get_current)):
    """
    Remove a user
    """

    dbuser = crud.get_user(db, username)
    if not dbuser:
        raise HTTPException(status_code=404, detail="User not found")

    if not (admin.is_sudo or (dbuser.admin and dbuser.admin.username == admin.username)):
        raise HTTPException(status_code=403, detail="You're not allowed")

    crud.remove_user(db, dbuser)
    for proxy in dbuser.proxies:
        for inbound in INBOUNDS.get(proxy.type, []):
            try:
                xray.api.remove_inbound_user(tag=inbound['tag'], email=username)
            except xray.exc.EmailNotFoundError:
                pass
    bg.add_task(
        telegram.report_user_deletion,
        username=dbuser.username,
        by=admin.username
    )
    logger.info(f"User \"{username}\" deleted")
    return {}


@ app.get("/api/users", tags=['User'], response_model=List[UserResponse])
def get_users(offset: int = None,
              limit: int = None,
              username: str = None,
              status: UserStatus = None,
              db: Session = Depends(get_db),
              admin: Admin = Depends(Admin.get_current)):
    """
    Get all users
    """
    dbadmin = crud.get_admin(db, admin.username)
    return crud.get_users(db, offset, limit, username, status, dbadmin)

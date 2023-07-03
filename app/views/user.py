import sqlalchemy
from datetime import datetime
from fastapi import BackgroundTasks, Depends, HTTPException

from app import app, logger, xray
from app.db import Session, crud, get_db
from app.models.admin import Admin
from app.models.user import (UserCreate, UserModify, UserResponse,
                             UsersResponse, UserStatus, UserUsagesResponse)
from app.utils import report


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
    - **proxies** dictionary of protocol:settings
    - **inbounds** dictionary of protocol:inbound_tags, empty means all inbounds
    """
    # TODO expire should be datetime instead of timestamp

    for proxy_type in new_user.proxies:
        if not xray.config.inbounds_by_protocol.get(proxy_type):
            raise HTTPException(status_code=400, detail=f"Protocol {proxy_type} is disabled on your server")

    try:
        dbuser = crud.create_user(db, new_user,
                                  admin=crud.get_admin(db, admin.username))
    except sqlalchemy.exc.IntegrityError:
        db.rollback()
        raise HTTPException(status_code=409, detail="User already exists")

    xray.operations.add_user(dbuser)

    bg.add_task(
        report.user_created,
        user_id=dbuser.id,
        username=dbuser.username,
        usage=dbuser.data_limit,
        expire_date=dbuser.expire,
        proxies=dbuser.proxies,
        by=admin.username
    )
    logger.info(f"New user \"{dbuser.username}\" added")
    return dbuser


@app.get("/api/user/{username}", tags=['User'], response_model=UserResponse)
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


@app.put("/api/user/{username}", tags=['User'], response_model=UserResponse)
def modify_user(username: str,
                modified_user: UserModify,
                bg: BackgroundTasks,
                db: Session = Depends(get_db),
                admin: Admin = Depends(Admin.get_current)):
    """
    Modify a user

    - set **expire** to 0 to make the user unlimited in time, null to no change
    - set **data_limit** to 0 to make the user unlimited in data, null to no change
    - **proxies** dictionary of protocol:settings, empty means no change
    - **inbounds** dictionary of protocol:inbound_tags, empty means no change
    """

    for proxy_type in modified_user.proxies:
        if not xray.config.inbounds_by_protocol.get(proxy_type):
            raise HTTPException(status_code=400, detail=f"Protocol {proxy_type} is disabled on your server")

    dbuser = crud.get_user(db, username)
    if not dbuser:
        raise HTTPException(status_code=404, detail="User not found")

    if not (admin.is_sudo or (dbuser.admin and dbuser.admin.username == admin.username)):
        raise HTTPException(status_code=403, detail="You're not allowed")

    old_status = dbuser.status
    dbuser = crud.update_user(db, dbuser, modified_user)
    user = UserResponse.from_orm(dbuser)

    if user.status == UserStatus.active:
        xray.operations.update_user(dbuser)
    else:
        xray.operations.remove_user(dbuser)

    bg.add_task(report.user_updated,
                username=dbuser.username,
                usage=dbuser.data_limit,
                expire_date=dbuser.expire,
                proxies=dbuser.proxies,
                by=admin.username)
    logger.info(f"User \"{user.username}\" modified")

    if user.status != old_status:
        bg.add_task(report.status_change,
                    username=user.username,
                    status=user.status)
        logger.info(f"User \"{dbuser.username}\" status changed from {old_status} to {user.status}")

    return user


@app.delete("/api/user/{username}", tags=['User'])
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

    xray.operations.remove_user(dbuser)

    bg.add_task(
        report.user_deleted,
        username=dbuser.username,
        by=admin.username
    )
    logger.info(f"User \"{username}\" deleted")
    return {}


@app.post("/api/user/{username}/reset", tags=['User'], response_model=UserResponse)
def reset_user_data_usage(username: str,
                          db: Session = Depends(get_db),
                          admin: Admin = Depends(Admin.get_current)):
    """
    Reset user data usage
    """
    dbuser = crud.get_user(db, username)
    if not dbuser:
        raise HTTPException(status_code=404, detail="User not found")

    if not (admin.is_sudo or (dbuser.admin and dbuser.admin.username == admin.username)):
        raise HTTPException(status_code=403, detail="You're not allowed")

    dbuser = crud.reset_user_data_usage(db=db, dbuser=dbuser)
    if dbuser.status == UserStatus.active:
        xray.operations.add_user(dbuser)

    return dbuser


@app.get("/api/users", tags=['User'], response_model=UsersResponse)
def get_users(offset: int = None,
              limit: int = None,
              username: str = None,
              status: UserStatus = None,
              sort: str = None,
              db: Session = Depends(get_db),
              admin: Admin = Depends(Admin.get_current)):
    """
    Get all users
    """
    dbadmin = crud.get_admin(db, admin.username)

    if sort is not None:
        opts = sort.strip(',').split(',')
        sort = []
        for opt in opts:
            try:
                sort.append(crud.UsersSortingOptions[opt])
            except KeyError:
                raise HTTPException(status_code=400,
                                    detail=f'"{opt}" is not a valid sort option')

    users, count = crud.get_users(db=db,
                                  offset=offset,
                                  limit=limit,
                                  username=username,
                                  status=status,
                                  sort=sort,
                                  admin=dbadmin if not admin.is_sudo else None,
                                  return_with_count=True)

    return {"users": users, "total": count}


@app.post("/api/users/reset", tags=['User'])
def reset_users_data_usage(db: Session = Depends(get_db),
                           admin: Admin = Depends(Admin.get_current)):
    """
    Reset all users data usage
    """
    dbadmin = crud.get_admin(db, admin.username)
    crud.reset_all_users_data_usage(db=db, admin=dbadmin)
    xray.core.restart(xray.config.include_db_users())
    for node_id, node in list(xray.nodes.items()):
        if node.connected:
            xray.operations.restart_node(node_id, xray.config.include_db_users())
    return {}


@app.get("/api/user/{username}/usage", tags=['User'], response_model=UserUsagesResponse)
def get_user(username: str,
             start: str = None,
             end: str = None,
             db: Session = Depends(get_db),
             admin: Admin = Depends(Admin.get_current)):
    """
    Get users usage
    """
    dbuser = crud.get_user(db, username)
    if not dbuser:
        raise HTTPException(status_code=404, detail="User not found")

    if start is None:
        start_date = datetime.fromtimestamp(datetime.utcnow().timestamp() - 30 * 24 * 3600)
    else:
        start_date = datetime.fromisoformat(start)

    if end is None:
        end_date = datetime.utcnow()
    else:
        end_date = datetime.fromisoformat(end)

    usages = crud.get_user_usages(db, dbuser, start_date, end_date)

    return {"usages": usages, "username": username}

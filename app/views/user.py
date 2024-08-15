from datetime import datetime, timedelta
from typing import List, Union, Optional

import sqlalchemy
from fastapi import BackgroundTasks, Depends, HTTPException, Query

from app import app, logger, xray
from app.db import Session, crud, get_db
from app.models.admin import Admin
from app.models.user import (UserCreate, UserModify, UserResponse,
                             UsersResponse, UserStatus, UserUsagesResponse)
from app.utils import report, validate


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
            raise HTTPException(
                status_code=400, detail=f"Protocol {proxy_type} is disabled on your server")

    try:
        dbuser = crud.create_user(db, new_user,
                                  admin=crud.get_admin(db, admin.username))
    except sqlalchemy.exc.IntegrityError:
        db.rollback()
        raise HTTPException(status_code=409, detail="User already exists")

    bg.add_task(xray.operations.add_user, dbuser=dbuser)
    user = UserResponse.from_orm(dbuser)
    report.user_created(
        user=user,
        user_id=dbuser.id,
        by=admin,
        user_admin=dbuser.admin
    )
    logger.info(f"New user \"{dbuser.username}\" added")
    return user


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
            raise HTTPException(
                status_code=400, detail=f"Protocol {proxy_type} is disabled on your server")

    dbuser = crud.get_user(db, username)
    if not dbuser:
        raise HTTPException(status_code=404, detail="User not found")

    if not (admin.is_sudo or (dbuser.admin and dbuser.admin.username == admin.username)):
        raise HTTPException(status_code=403, detail="You're not allowed")

    old_status = dbuser.status
    dbuser = crud.update_user(db, dbuser, modified_user)
    user = UserResponse.from_orm(dbuser)

    if user.status in [UserStatus.active, UserStatus.on_hold]:
        bg.add_task(xray.operations.update_user, dbuser=dbuser)
    else:
        bg.add_task(xray.operations.remove_user, dbuser=dbuser)

    bg.add_task(report.user_updated,
                user=user,
                user_admin=dbuser.admin,
                by=admin)
    logger.info(f"User \"{user.username}\" modified")

    if user.status != old_status:
        bg.add_task(report.status_change,
                    username=user.username,
                    status=user.status,
                    user=user,
                    user_admin=dbuser.admin,
                    by=admin)
        logger.info(
            f"User \"{dbuser.username}\" status changed from {old_status} to {user.status}")

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

    user_admin = dbuser.admin
    crud.remove_user(db, dbuser)

    bg.add_task(xray.operations.remove_user, dbuser=dbuser)

    bg.add_task(
        report.user_deleted,
        username=dbuser.username,
        user_admin=user_admin,
        by=admin
    )
    logger.info(f"User \"{username}\" deleted")
    return {}


@app.post("/api/user/{username}/reset", tags=['User'], response_model=UserResponse)
def reset_user_data_usage(username: str,
                          bg: BackgroundTasks,
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
    if dbuser.status in [UserStatus.active, UserStatus.on_hold]:
        bg.add_task(xray.operations.add_user, dbuser=dbuser)

    user = UserResponse.from_orm(dbuser)
    bg.add_task(report.user_data_usage_reset,
                user=user,
                user_admin=dbuser.admin,
                by=admin)

    logger.info(f"User \"{username}\"'s usage was reset")

    return dbuser


@app.post("/api/user/{username}/revoke_sub", tags=['User'], response_model=UserResponse)
def revoke_user_subscription(username: str,
                             bg: BackgroundTasks,
                             db: Session = Depends(get_db),
                             admin: Admin = Depends(Admin.get_current)):
    """
    Revoke users subscription (Subscription link and proxies)
    """
    dbuser = crud.get_user(db, username)
    if not dbuser:
        raise HTTPException(status_code=404, detail="User not found")

    if not (admin.is_sudo or (dbuser.admin and dbuser.admin.username == admin.username)):
        raise HTTPException(status_code=403, detail="You're not allowed")

    dbuser = crud.revoke_user_sub(db=db, dbuser=dbuser)

    if dbuser.status in [UserStatus.active, UserStatus.on_hold]:
        bg.add_task(xray.operations.update_user, dbuser=dbuser)
    user = UserResponse.from_orm(dbuser)
    bg.add_task(
        report.user_subscription_revoked,
        user=user,
        user_admin=dbuser.admin,
        by=admin
    )

    logger.info(f"User \"{username}\" subscription revoked")

    return user


@app.get("/api/users", tags=['User'], response_model=UsersResponse)
def get_users(offset: int = None,
              limit: int = None,
              username: List[str] = Query(None),
              search: Union[str, None] = None,
              owner: Union[List[str], None] = Query(None, alias="admin"),
              status: UserStatus = None,
              sort: str = None,
              db: Session = Depends(get_db),
              admin: Admin = Depends(Admin.get_current)):
    """
    Get all users
    """
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
                                  search=search,
                                  usernames=username,
                                  status=status,
                                  sort=sort,
                                  admins=owner if admin.is_sudo else [admin.username],
                                  return_with_count=True)

    return {"users": users, "total": count}


@app.post("/api/users/reset", tags=['User'])
def reset_users_data_usage(db: Session = Depends(get_db),
                           admin: Admin = Depends(Admin.get_current)):
    """
    Reset all users data usage
    """
    if not admin.is_sudo:
        raise HTTPException(status_code=403, detail="You're not allowed")

    dbadmin = crud.get_admin(db, admin.username)
    crud.reset_all_users_data_usage(db=db, admin=dbadmin)
    startup_config = xray.config.include_db_users()
    xray.core.restart(startup_config)
    for node_id, node in list(xray.nodes.items()):
        if node.connected:
            xray.operations.restart_node(node_id, startup_config)
    return {}


@app.get("/api/user/{username}/usage", tags=['User'], response_model=UserUsagesResponse)
def get_user_usage(username: str,
                   start: datetime = Query(None, example="2024-01-01T00:00:00"),
                   end: datetime = Query(None, example="2024-01-31T23:59:59"),
                   db: Session = Depends(get_db),
                   admin: Admin = Depends(Admin.get_current)):
    """
    Get users usage
    """
    dbuser = crud.get_user(db, username)
    if not dbuser:
        raise HTTPException(status_code=404, detail="User not found")

    if not validate.validate_dates(start, end):
        raise HTTPException(status_code=400, detail="Invalid date range or format")

    start_date = start if start else datetime.utcnow() - timedelta(days=30)
    end_date = end if end else datetime.utcnow()

    usages = crud.get_user_usages(db, dbuser, start_date, end_date)

    return {"usages": usages, "username": username}


@app.put("/api/user/{username}/set-owner", tags=['User'], response_model=UserResponse)
def set_owner(username: str,
              admin_username: str,
              db: Session = Depends(get_db),
              admin: Admin = Depends(Admin.get_current)):

    if not admin.is_sudo:
        raise HTTPException(status_code=403, detail="You're not allowed")

    dbuser = crud.get_user(db, username)
    if not dbuser:
        raise HTTPException(status_code=404, detail="User not found")

    new_admin = crud.get_admin(db, username=admin_username)
    if not new_admin:
        raise HTTPException(status_code=404, detail="Admin not found")

    dbuser = crud.set_owner(db, dbuser, new_admin)
    user = UserResponse.from_orm(dbuser)

    logger.info(f"{user.username}\"owner successfully set to{admin.username}")

    return user


@app.get("/api/users/expired", tags=['User'], response_model=List[str])
def get_expired_users_api(
    expired_after: Optional[datetime] = Query(None, example="2024-01-01T00:00:00"),
    expired_before: Optional[datetime] = Query(None, example="2024-01-31T23:59:59"),
    db: Session = Depends(get_db),
    admin: Admin = Depends(Admin.get_current)
):
    """
    Get users who have expired within the specified date range.

    - **expired_after** UTC datetime (optional)
    - **expired_before** UTC datetime (optional)
    - At least one of expired_after or expired_before must be provided for filtering
    - If both are omitted, returns all expired users
    """
    if not validate.validate_dates(expired_after, expired_before, allow_both_none=True):
        raise HTTPException(status_code=400, detail="Invalid date range or format")

    expired_users = validate.get_expired_users(db, admin, expired_after, expired_before)
    return [u.username for u in expired_users]


@app.delete("/api/users/expired", tags=['User'], response_model=List[str])
def delete_expired_users(
    bg: BackgroundTasks,
    expired_after: Optional[datetime] = Query(None, example="2024-01-01T00:00:00"),
    expired_before: Optional[datetime] = Query(None, example="2024-01-31T23:59:59"),
    db: Session = Depends(get_db),
    admin: Admin = Depends(Admin.get_current)
):
    """
    Delete users who have expired within the specified date range.

    - **expired_after** UTC datetime (optional)
    - **expired_before** UTC datetime (optional)
    - At least one of expired_after or expired_before must be provided
    """
    if expired_after is None and expired_before is None:
        raise HTTPException(status_code=400, detail="At least one of expired_after or expired_before must be provided")

    if not validate.validate_dates(expired_after, expired_before, allow_both_none=False):
        raise HTTPException(status_code=400, detail="Invalid date range or format")

    expired_users = validate.get_expired_users(db, admin, expired_after, expired_before)
    removed_users = [u.username for u in expired_users]
    
    if not removed_users:
        raise HTTPException(status_code=404, detail="No expired users found in the specified date range")
    
    crud.remove_users(db, expired_users)

    for removed_user in removed_users:
        logger.info(f"User \"{removed_user}\" deleted")
        bg.add_task(report.user_deleted, username=removed_user, user_admin=next((u.admin for u in expired_users if u.username == removed_user), None), by=admin)

    return removed_users

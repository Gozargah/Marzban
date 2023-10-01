from datetime import datetime

from fastapi import Depends, HTTPException, Response

from app import app
from app.db import Session, crud, get_db
from app.models.admin import Admin
from app.models.user import Action, UserLogsResponse


@app.get("/api/log/users", tags=['Log'], response_model = UserLogsResponse)
def get_users_logs(admin_username: str = None,
                  username: str = None,
                  start: int = None,
                  end: int = None,
                  action: Action = None,
                  db: Session = Depends(get_db),
                  admin: Admin = Depends(Admin.get_current)):
    
    if start :
        start = datetime.fromtimestamp(start)
    if end :
        end = datetime.fromtimestamp(end)

    logs = crud.get_user_logs(db, admin,
                              admin_username = admin_username, username = username, 
                              start = start, end = end, action = action)

    return {"logs": logs}


@app.get("/api/log/{username}", tags=['Log'], response_model = UserLogsResponse)
def get_user_logs(username: str,
                  start: int = None,
                  end: int = None,
                  action: Action = None,
                  db: Session = Depends(get_db),
                  admin: Admin = Depends(Admin.get_current)):
    
    dbuser = crud.get_user(db, username)
    if not dbuser:
        raise HTTPException(status_code=404, detail="User not found")

    if not (admin.is_sudo or (dbuser.admin and dbuser.admin.username == admin.username)):
        raise HTTPException(status_code=403, detail="You're not allowed")
    
    if start :
        start = datetime.fromtimestamp(start)
    if end :
        end = datetime.fromtimestamp(end)

    logs = crud.get_user_logs(db, admin, user_id = dbuser.id, 
                              start = start, end = end, action = action)

    return {"logs": logs}

@app.get("/api/log/users/csv", tags=['Log'])
def get_users_logs_csv(admin_username: str = None,
                       username: str = None,
                       start: int = None,
                       end: int = None,
                       action: Action = None,
                       db: Session = Depends(get_db),
                       admin: Admin = Depends(Admin.get_current)):
    
    if start :
        start = datetime.fromtimestamp(start)
    if end :
        end = datetime.fromtimestamp(end)

    logs = crud.get_user_logs(db, admin,
                              admin_username = admin_username, username = username, 
                              start = start, end = end, action = action)

    if not logs:
        response = Response(content="", media_type="text/csv")
    else:
        csv_data = crud.convert_to_csv(logs)
        response = Response(content=csv_data, media_type="text/csv")

    response.headers["Content-Disposition"] = "attachment; filename=user_logs.csv"
    
    return response


@app.get("/api/log/{username}/csv", tags=['Log'])
def get_user_logs_csv(username: str,
                      start: int = None,
                      end: int = None,
                      action: Action = None,
                      db: Session = Depends(get_db),
                      admin: Admin = Depends(Admin.get_current)):
    
    dbuser = crud.get_user(db, username)
    if not dbuser:
        raise HTTPException(status_code=404, detail="User not found")

    if not (admin.is_sudo or (dbuser.admin and dbuser.admin.username == admin.username)):
        raise HTTPException(status_code=403, detail="You're not allowed")
    
    if start:
        start = datetime.fromtimestamp(start)
    if end:
        end = datetime.fromtimestamp(end)

    logs = crud.get_user_logs(db, admin, user_id=dbuser.id, 
                              start=start, end=end, action=action)
    
    if not logs:
        response = Response(content="", media_type="text/csv")
    else:
        csv_data = crud.convert_to_csv(logs)
        response = Response(content=csv_data, media_type="text/csv")

    response.headers["Content-Disposition"] = "attachment; filename=user_logs.csv"
    
    return response

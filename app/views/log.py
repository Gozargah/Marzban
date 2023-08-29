from fastapi import Depends, HTTPException

from app import app
from app.db import Session, crud, get_db
from app.models.admin import Admin
from app.models.user import Action, UserLogsResponse


@app.get("/api/log/userlogs", tags=['Log'], response_model = UserLogsResponse)
def get_user_logs(admin_username: str = None,
                  username: str = None,
                  start: int = None,
                  end: int = None,
                  action: Action = None,
                  db: Session = Depends(get_db),
                  admin: Admin = Depends(Admin.get_current)):
    dbuser = None
    
    if username:
        dbuser = crud.get_user(db, username)
        if not (admin.is_sudo or (dbuser.admin and dbuser.admin.username == admin.username) or not dbuser):
            raise HTTPException(status_code=404, detail="User Not Found")

    logs = crud.get_user_logs(db, admin,
                                admin_username, dbuser, start, end, action)

    return {"logs": logs}
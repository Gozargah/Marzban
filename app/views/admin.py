from datetime import timedelta

from app import app, jwt
from app.models.admin import Admin, Token
from config import ADMINS
from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordRequestForm


def is_admin(username: str, password: str):
    try:
        return password == ADMINS[username]
    except KeyError:
        return False


@app.post("/admin/token", tags=['Admin'], response_model=Token)
async def login_for_access_token(form_data: OAuth2PasswordRequestForm = Depends()):
    if not is_admin(form_data.username, form_data.password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect username or password",
            headers={"WWW-Authenticate": "Bearer"},
        )
    access_token = jwt.create_access_token(username=form_data.username)
    return {
        "access_token": access_token,
        "token_type": "bearer"
    }


@app.get("/admin", tags=['Admin'], response_model=Admin)
async def current_admin(admin: Admin = Depends(jwt.current_user)):
    return {"username": admin}

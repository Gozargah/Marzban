from datetime import datetime, timedelta
from typing import Union

import sqlalchemy
from app import app
from config import JWT_ACCESS_TOKEN_EXPIRE_MINUTES
from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from jose import JWTError, jwt


oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/admin/token")  # Admin view url

global JWT_SECRET_KEY


@app.on_event("startup")
def set_jwt_secret_key():
    from app.db import get_db, get_jwt_secret_key, engine, JWT
    if sqlalchemy.inspect(engine).has_table(JWT.__tablename__):
        for db in get_db():
            global JWT_SECRET_KEY
            JWT_SECRET_KEY = get_jwt_secret_key(db)


def create_admin_token(username: str) -> str:
    data = {"sub": username, "access": "admin"}
    if JWT_ACCESS_TOKEN_EXPIRE_MINUTES > 0:
        expire = datetime.utcnow() + timedelta(minutes=JWT_ACCESS_TOKEN_EXPIRE_MINUTES)
        data["exp"] = expire
    encoded_jwt = jwt.encode(data, JWT_SECRET_KEY, algorithm="HS256")
    return encoded_jwt


async def current_admin(token: str = Depends(oauth2_scheme)) -> str:
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = jwt.decode(token, JWT_SECRET_KEY, algorithms=["HS256"])
        username: str = payload.get("sub")
        access: str = payload.get("access")
        if username is None or access != "admin":
            raise credentials_exception
    except JWTError:
        raise credentials_exception
    return username


def create_subscription_token(username: str) -> str:
    data = {"sub": username, "access": "subscription", "iat": datetime.utcnow()+timedelta(seconds=1)}
    encoded_jwt = jwt.encode(data, JWT_SECRET_KEY, algorithm="HS256")
    return encoded_jwt


def get_subscription_payload(token: str) -> Union[dict, None]:
    try:
        payload = jwt.decode(token, JWT_SECRET_KEY, algorithms=["HS256"])
        if payload.get("access") != "subscription":
            return

        return {"username": payload['sub'], "created_at": datetime.utcfromtimestamp(payload['iat'])}
    except JWTError:
        return

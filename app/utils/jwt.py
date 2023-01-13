from datetime import datetime, timedelta
from typing import Union

import sqlalchemy
from app import app
from config import JWT_ACCESS_TOKEN_EXPIRE_MINUTES
from jose import JWTError, jwt

global JWT_SECRET_KEY


@app.on_event("startup")
def set_jwt_secret_key():
    from app.db import JWT, engine, get_db, get_jwt_secret_key
    if sqlalchemy.inspect(engine).has_table(JWT.__tablename__):
        for db in get_db():
            global JWT_SECRET_KEY
            JWT_SECRET_KEY = get_jwt_secret_key(db)


def create_admin_token(username: str, is_sudo=False) -> str:
    data = {"sub": username, "access": "sudo" if is_sudo else "admin"}
    if JWT_ACCESS_TOKEN_EXPIRE_MINUTES > 0:
        expire = datetime.utcnow() + timedelta(minutes=JWT_ACCESS_TOKEN_EXPIRE_MINUTES)
        data["exp"] = expire
    encoded_jwt = jwt.encode(data, JWT_SECRET_KEY, algorithm="HS256")
    return encoded_jwt


def get_admin_payload(token: str) -> Union[dict, None]:
    try:
        payload = jwt.decode(token, JWT_SECRET_KEY, algorithms=["HS256"])
        username: str = payload.get("sub")
        access: str = payload.get("access")
        if not username or access not in ('admin', 'sudo'):
            return

        return {"username": username, "is_sudo": access == "sudo"}
    except JWTError:
        return


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

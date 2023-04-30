from datetime import datetime, timedelta
from functools import lru_cache
from typing import Union

from jose import JWTError, jwt

from config import JWT_ACCESS_TOKEN_EXPIRE_MINUTES


@lru_cache(maxsize=None)
def get_secret_key():
    from app.db import GetDB, get_jwt_secret_key
    with GetDB() as db:
        return get_jwt_secret_key(db)


def create_admin_token(username: str, is_sudo=False) -> str:
    data = {"sub": username, "access": "sudo" if is_sudo else "admin"}
    if JWT_ACCESS_TOKEN_EXPIRE_MINUTES > 0:
        expire = datetime.utcnow() + timedelta(minutes=JWT_ACCESS_TOKEN_EXPIRE_MINUTES)
        data["exp"] = expire
    encoded_jwt = jwt.encode(data, get_secret_key(), algorithm="HS256")
    return encoded_jwt


def get_admin_payload(token: str) -> Union[dict, None]:
    try:
        payload = jwt.decode(token, get_secret_key(), algorithms=["HS256"])
        username: str = payload.get("sub")
        access: str = payload.get("access")
        if not username or access not in ('admin', 'sudo'):
            return

        return {"username": username, "is_sudo": access == "sudo"}
    except JWTError:
        return


def create_subscription_token(username: str) -> str:
    data = {"sub": username, "access": "subscription", "iat": datetime.utcnow()+timedelta(seconds=1)}
    encoded_jwt = jwt.encode(data, get_secret_key(), algorithm="HS256")
    return encoded_jwt


def get_subscription_payload(token: str) -> Union[dict, None]:
    try:
        payload = jwt.decode(token, get_secret_key(), algorithms=["HS256"])
        if payload.get("access") != "subscription":
            return

        return {"username": payload['sub'], "created_at": datetime.utcfromtimestamp(payload['iat'])}
    except JWTError:
        return

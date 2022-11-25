from datetime import datetime, timedelta

import sqlalchemy
from config import JWT_ACCESS_TOKEN_EXPIRE_MINUTES
from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from jose import JWTError, jwt

from app.db import get_db, get_jwt_secret_key, engine, JWT

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/admin/token")  # Admin view url

if sqlalchemy.inspect(engine).has_table(JWT.__tablename__):
    for db in get_db():
        JWT_SECRET_KEY = get_jwt_secret_key(db)


def create_access_token(username: str) -> str:
    expire = datetime.utcnow() + timedelta(minutes=JWT_ACCESS_TOKEN_EXPIRE_MINUTES)
    data = {"sub": username, "exp": expire}
    encoded_jwt = jwt.encode(data, JWT_SECRET_KEY, algorithm="HS256")
    return encoded_jwt


async def current_user(token: str = Depends(oauth2_scheme)) -> str:
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = jwt.decode(token, JWT_SECRET_KEY, algorithms=["HS256"])
        username: str = payload.get("sub")
        if username is None:
            raise credentials_exception
    except JWTError:
        raise credentials_exception
    return username

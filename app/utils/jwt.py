import time
import jwt
from base64 import b64decode, b64encode
from datetime import datetime, timedelta, timezone
from hashlib import sha256
from math import ceil

from aiocache import cached
from app.db import GetDB
from app.db.crud.general import get_jwt_secret_key
from config import JWT_ACCESS_TOKEN_EXPIRE_MINUTES


@cached()
async def get_secret_key():
    async with GetDB() as db:
        key = await get_jwt_secret_key(db=db)
        return key


async def create_admin_token(username: str, is_sudo=False) -> str:
    data = {"sub": username, "access": "sudo" if is_sudo else "admin", "iat": datetime.utcnow()}
    if JWT_ACCESS_TOKEN_EXPIRE_MINUTES > 0:
        expire = datetime.now(timezone.utc) + timedelta(minutes=JWT_ACCESS_TOKEN_EXPIRE_MINUTES)
        data["exp"] = expire
    encoded_jwt = jwt.encode(data, await get_secret_key(), algorithm="HS256")
    return encoded_jwt


async def get_admin_payload(token: str) -> dict | None:
    try:
        payload = jwt.decode(token, await get_secret_key(), algorithms=["HS256"])
        username: str = payload.get("sub")
        access: str = payload.get("access")
        if not username or access not in ("admin", "sudo"):
            return
        try:
            created_at = datetime.fromtimestamp(payload["iat"], tz=timezone.utc)
        except KeyError:
            created_at = None

        return {"username": username, "is_sudo": access == "sudo", "created_at": created_at}
    except jwt.exceptions.PyJWTError:
        return


async def create_subscription_token(username: str) -> str:
    data = username + "," + str(ceil(time.time()))
    data_b64_str = b64encode(data.encode("utf-8"), altchars=b"-_").decode("utf-8").rstrip("=")
    data_b64_sign = b64encode(
        sha256((data_b64_str + await get_secret_key()).encode("utf-8")).digest(), altchars=b"-_"
    ).decode("utf-8")[:10]
    data_final = data_b64_str + data_b64_sign
    return data_final


async def get_subscription_payload(token: str) -> dict | None:
    try:
        if len(token) < 15:
            return

        if token.startswith("eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9."):
            payload = jwt.decode(token, await get_secret_key(), algorithms=["HS256"])
            if payload.get("access") == "subscription":
                return {
                    "username": payload["sub"],
                    "created_at": datetime.fromtimestamp(payload["iat"], tz=timezone.utc),
                }
            else:
                return
        else:
            u_token = token[:-10]
            u_signature = token[-10:]
            try:
                u_token_dec = b64decode(
                    (u_token.encode("utf-8") + b"=" * (-len(u_token.encode("utf-8")) % 4)),
                    altchars=b"-_",
                    validate=True,
                )
                u_token_dec_str = u_token_dec.decode("utf-8")
            except Exception:
                return
            u_token_resign = b64encode(
                sha256((u_token + await get_secret_key()).encode("utf-8")).digest(), altchars=b"-_"
            ).decode("utf-8")[:10]
            if u_signature == u_token_resign:
                u_username = u_token_dec_str.split(",")[0]
                u_created_at = int(u_token_dec_str.split(",")[1])
                return {"username": u_username, "created_at": datetime.fromtimestamp(u_created_at, tz=timezone.utc)}
            else:
                return
    except jwt.exceptions.PyJWTError:
        return

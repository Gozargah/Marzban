import time
import jwt
from base64 import b64decode, b64encode
from datetime import datetime, timedelta
from functools import lru_cache
from hashlib import sha256
from math import ceil
from typing import Union, Optional


from config import JWT_ACCESS_TOKEN_EXPIRE_MINUTES


@lru_cache(maxsize=None)
def get_secret_key():
    from app.db import GetDB, get_jwt_secret_key
    with GetDB() as db:
        return get_jwt_secret_key(db)


def clear_jwt_cache():
    """
    Clear the JWT secret key cache to force reloading from database
    """
    get_secret_key.cache_clear()


def is_token_blacklisted(token_id: str) -> bool:
    from app.db.token_blacklist import is_token_in_blacklist
    from app.db import GetDB
    with GetDB() as db:
        return is_token_in_blacklist(db, token_id)


def create_admin_token(username: str, is_sudo=False) -> str:
    token_id = f"{username}_{int(time.time())}"
    data = {
        "sub": username, 
        "access": "sudo" if is_sudo else "admin", 
        "iat": datetime.utcnow(),
        "jti": token_id
    }
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
        token_id: str = payload.get("jti")
        
        if not username or access not in ('admin', 'sudo'):
            return None
            
        if token_id and is_token_blacklisted(token_id):
            return None
            
        try:
            created_at = datetime.utcfromtimestamp(payload['iat'])
        except KeyError:
            created_at = None

        return {
            "username": username, 
            "is_sudo": access == "sudo", 
            "created_at": created_at,
            "token_id": token_id
        }
    except jwt.exceptions.ExpiredSignatureError:
        return None
    except jwt.exceptions.InvalidTokenError:
        return None
    except jwt.exceptions.PyJWTError:
        return None


def create_subscription_token(username: str) -> str:
    token_id = f"sub_{username}_{int(time.time())}"
    data = {
        "sub": username,
        "access": "subscription",
        "iat": ceil(time.time()),
        "jti": token_id
    }
    encoded_jwt = jwt.encode(data, get_secret_key(), algorithm="HS256")
    return encoded_jwt


def get_subscription_payload(token: str) -> Union[dict, None]:
    try:
        if len(token) < 15:
            return None

        if token.startswith("eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9."):
            try:
                payload = jwt.decode(token, get_secret_key(), algorithms=["HS256"])
                if payload.get("access") == "subscription":
                    token_id = payload.get("jti")
                    if token_id and is_token_blacklisted(token_id):
                        return None
                    return {"username": payload['sub'], "created_at": datetime.utcfromtimestamp(payload['iat'])}
                else:
                    return None
            except jwt.exceptions.PyJWTError:
                return None
        else:
            u_token = token[:-10]
            u_signature = token[-10:]
            try:
                u_token_dec = b64decode(
                    (u_token.encode('utf-8') + b'=' * (-len(u_token.encode('utf-8')) % 4)),
                    altchars=b'-_', validate=True)
                u_token_dec_str = u_token_dec.decode('utf-8')
            except:
                return None
            u_token_resign = b64encode(sha256((u_token+get_secret_key()).encode('utf-8')
                                              ).digest(), altchars=b'-_').decode('utf-8')[:10]
            if u_signature == u_token_resign:
                u_username = u_token_dec_str.split(',')[0]
                u_created_at = int(u_token_dec_str.split(',')[1])
                return {"username": u_username, "created_at": datetime.utcfromtimestamp(u_created_at)}
            else:
                return None
    except Exception:
        return None


def blacklist_token(token_id: str, expiration: Optional[datetime] = None) -> bool:
    from app.db.token_blacklist import add_token_to_blacklist
    from app.db import GetDB
    with GetDB() as db:
        return add_token_to_blacklist(db, token_id, expiration)


def revoke_token(token: str) -> bool:
    try:
        payload = jwt.decode(token, get_secret_key(), algorithms=["HS256"])
        token_id = payload.get("jti")
        if not token_id:
            return False
            
        expiration = payload.get("exp")
        exp_datetime = None
        if expiration:
            exp_datetime = datetime.utcfromtimestamp(expiration)
            
        return blacklist_token(token_id, exp_datetime)
    except jwt.exceptions.PyJWTError:
        return False

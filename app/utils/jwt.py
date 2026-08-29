import hmac
import logging
import time
import jwt
from base64 import b64decode, b64encode
from datetime import datetime, timedelta
from functools import lru_cache
from hashlib import sha256
from math import ceil
from typing import Optional, Union


from config import ACCEPT_LEGACY_SUBSCRIPTION_TOKENS, JWT_ACCESS_TOKEN_EXPIRE_MINUTES

# Separates the payload from its signature in subscription tokens. Legacy
# tokens have no separator, which is what tells the two formats apart.
SUBSCRIPTION_TOKEN_SEPARATOR = "."
LEGACY_SUBSCRIPTION_SIGNATURE_LENGTH = 10

logger = logging.getLogger("uvicorn.error")

# Said once per process. It answers the one question that decides whether
# ACCEPT_LEGACY_SUBSCRIPTION_TOKENS can be turned off — is anybody still on a
# link issued before the change? — and saying it per request would flood the
# log of exactly the panel that has not migrated yet.
_warned_about_legacy_token = False


def _warn_about_legacy_token_once(username: str) -> None:
    global _warned_about_legacy_token

    if _warned_about_legacy_token:
        return

    _warned_about_legacy_token = True
    logger.warning(
        f'Served "{username}" from a subscription link issued before the signature change. '
        "Those links carry a 60-bit truncated hash instead of an HMAC, and are honoured only "
        "because ACCEPT_LEGACY_SUBSCRIPTION_TOKENS is on. Give the users still on them their "
        "current link from the panel, then set it to false. This is logged once per restart, "
        "so a quiet log after a few days of uptime means nobody is using an old link."
    )


@lru_cache(maxsize=None)
def get_secret_key():
    from app.db import GetDB, get_jwt_secret_key
    with GetDB() as db:
        return get_jwt_secret_key(db)


def token_expiry_warning(minutes: int) -> Optional[str]:
    """Why a configured expiry of zero is worth saying out loud, or None.

    Zero is a supported setting — some API clients hold a token indefinitely —
    but it is easy to arrive at by accident, and what it costs is not obvious
    from the name of the variable.
    """
    if minutes > 0:
        return None

    return (
        f"JWT_ACCESS_TOKEN_EXPIRE_MINUTES is {minutes}, so admin tokens carry no expiry and "
        "stay valid for as long as the panel keeps its signing key. A token that leaks — out "
        "of a shell history, a script, a proxy log — can only be taken back by changing that "
        "admin's password. Set it to a number of minutes (1440 is a day) unless something you "
        "run depends on a token that does not run out."
    )


def create_admin_token(username: str, is_sudo=False) -> str:
    data = {"sub": username, "access": "sudo" if is_sudo else "admin", "iat": datetime.utcnow()}
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
        try:
            created_at = datetime.utcfromtimestamp(payload['iat'])
        except KeyError:
            created_at = None

        return {"username": username, "is_sudo": access == "sudo", "created_at": created_at}
    except jwt.exceptions.PyJWTError:
        return


def _urlsafe_b64encode(raw: bytes) -> str:
    return b64encode(raw, altchars=b'-_').decode('utf-8').rstrip('=')


def _urlsafe_b64decode(data: str) -> bytes:
    padded = data.encode('utf-8') + b'=' * (-len(data.encode('utf-8')) % 4)
    return b64decode(padded, altchars=b'-_', validate=True)


def _sign_subscription_data(data_b64: str) -> str:
    """Sign the encoded payload with HMAC-SHA256."""
    return _urlsafe_b64encode(
        hmac.new(
            get_secret_key().encode('utf-8'),
            data_b64.encode('utf-8'),
            sha256
        ).digest()
    )


def _legacy_sign_subscription_data(data_b64: str) -> str:
    """Reproduce the pre-HMAC signature, for verifying already issued tokens.

    This is a plain sha256 over payload+secret truncated to 10 base64
    characters. It is only ever used to verify, never to issue.
    """
    return b64encode(
        sha256((data_b64 + get_secret_key()).encode('utf-8')).digest(),
        altchars=b'-_'
    ).decode('utf-8')[:LEGACY_SUBSCRIPTION_SIGNATURE_LENGTH]


def _subscription_payload_from_b64(data_b64: str) -> Optional[dict]:
    """Decode the payload half of a subscription token whose signature is valid."""
    try:
        decoded = _urlsafe_b64decode(data_b64).decode('utf-8')
        username, created_at = decoded.rsplit(',', 1)
        if not username:
            return
        return {"username": username, "created_at": datetime.utcfromtimestamp(int(created_at))}
    except (ValueError, OverflowError, OSError, UnicodeDecodeError):
        return


def create_subscription_token(username: str) -> str:
    data = username + ',' + str(ceil(time.time()))
    data_b64_str = _urlsafe_b64encode(data.encode('utf-8'))
    return data_b64_str + SUBSCRIPTION_TOKEN_SEPARATOR + _sign_subscription_data(data_b64_str)


def get_subscription_payload(token: str) -> Union[dict, None]:
    try:
        if len(token) < 15:
            return

        if token.startswith("eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9."):
            payload = jwt.decode(token, get_secret_key(), algorithms=["HS256"])
            if payload.get("access") == "subscription":
                return {"username": payload['sub'], "created_at": datetime.utcfromtimestamp(payload['iat'])}
            else:
                return

        if SUBSCRIPTION_TOKEN_SEPARATOR in token:
            data_b64, _, signature = token.rpartition(SUBSCRIPTION_TOKEN_SEPARATOR)
            if not data_b64 or not hmac.compare_digest(signature, _sign_subscription_data(data_b64)):
                return
            return _subscription_payload_from_b64(data_b64)

        if not ACCEPT_LEGACY_SUBSCRIPTION_TOKENS:
            return

        data_b64 = token[:-LEGACY_SUBSCRIPTION_SIGNATURE_LENGTH]
        signature = token[-LEGACY_SUBSCRIPTION_SIGNATURE_LENGTH:]
        if not hmac.compare_digest(signature, _legacy_sign_subscription_data(data_b64)):
            return

        payload = _subscription_payload_from_b64(data_b64)
        if payload:
            _warn_about_legacy_token_once(payload["username"])
        return payload

    except jwt.exceptions.PyJWTError:
        return

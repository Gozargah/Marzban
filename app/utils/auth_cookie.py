"""The admin session cookie.

The dashboard authenticates with an httpOnly cookie instead of keeping the
JWT in localStorage, where any script running on the page could read it.
The token is still returned in the login response body so the CLI and
third-party API clients keep working with the Authorization header.
"""

from typing import Optional

from fastapi import Request, Response
from starlette.websockets import WebSocket

from app.utils.client_ip import is_secure_request
from config import JWT_ACCESS_TOKEN_EXPIRE_MINUTES

ACCESS_TOKEN_COOKIE_NAME = "xenith_access_token"


def _cookie_kwargs(request: Request) -> dict:
    return {
        "key": ACCESS_TOKEN_COOKIE_NAME,
        "path": "/",
        "httponly": True,
        # Strict keeps the cookie off every cross-site request, which is what
        # makes cookie authentication safe from CSRF here.
        "samesite": "strict",
        "secure": is_secure_request(request),
    }


def set_access_cookie(response: Response, request: Request, token: str) -> None:
    max_age = JWT_ACCESS_TOKEN_EXPIRE_MINUTES * 60 if JWT_ACCESS_TOKEN_EXPIRE_MINUTES > 0 else None
    response.set_cookie(value=token, max_age=max_age, **_cookie_kwargs(request))


def clear_access_cookie(response: Response, request: Request) -> None:
    response.delete_cookie(**_cookie_kwargs(request))


def token_from_cookie(connection) -> Optional[str]:
    """Read the session token off a request or websocket handshake."""
    return connection.cookies.get(ACCESS_TOKEN_COOKIE_NAME) or None


def token_from_websocket(websocket: WebSocket) -> str:
    """Token for a websocket: the cookie first, then the legacy query/header."""
    return (
        token_from_cookie(websocket)
        or websocket.query_params.get("token")
        or websocket.headers.get("Authorization", "").removeprefix("Bearer ")
    )

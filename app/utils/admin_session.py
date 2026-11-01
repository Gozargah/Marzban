import hmac
from urllib.parse import urlsplit

from fastapi import HTTPException, Request, WebSocket, status

from config import ALLOWED_ORIGINS

SESSION_COOKIE = "marzban_session"
CSRF_COOKIE = "marzban_csrf"
CSRF_HEADER = "x-csrf-token"


def is_trusted_origin(origin: str | None, request: Request | WebSocket) -> bool:
    if not origin:
        return False
    if "*" not in ALLOWED_ORIGINS and origin in ALLOWED_ORIGINS:
        return True
    parsed = urlsplit(origin)
    host = request.headers.get("host", "").lower()
    return parsed.netloc.lower() == host and parsed.scheme in ("http", "https")


def require_same_origin(request: Request) -> None:
    if not is_trusted_origin(request.headers.get("origin"), request):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Untrusted request origin")


def require_csrf(request: Request) -> None:
    require_same_origin(request)
    cookie_token = request.cookies.get(CSRF_COOKIE, "")
    header_token = request.headers.get(CSRF_HEADER, "")
    if not cookie_token or not hmac.compare_digest(cookie_token, header_token):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="CSRF validation failed")


def is_admin_session_active(session_id: str) -> bool:
    from hashlib import sha256
    from app.db import GetDB
    from app.db.models import AdminSession

    session_hash = sha256(session_id.encode()).hexdigest()
    with GetDB() as db:
        return db.query(AdminSession.id).filter(AdminSession.session_hash == session_hash).first() is not None

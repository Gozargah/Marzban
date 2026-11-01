"""Isolated ASGI app and test doubles for Bun's backend security integration tests."""
from collections import deque
from contextlib import contextmanager
import asyncio
import json
import sys
from urllib.parse import urlsplit

from fastapi import Depends, FastAPI, Request

from app.db import Session, get_db
from app.models.admin import Admin, pwd_context
from app.routers.admin import router as admin_router
from app.routers.core import core_logs
from app.routers.node import node_logs
from app.db.models import Admin as AdminRow, AdminSession
from app.db import SessionLocal
from sqlalchemy import inspect


def inspect_database():
    inspector = inspect(SessionLocal.kw["bind"])
    with SessionLocal() as db:
        revision = db.execute(__import__("sqlalchemy").text("SELECT version_num FROM alembic_version")).scalar_one()
        admins = [
            {"username": row.username, "is_sudo": row.is_sudo}
            for row in db.query(AdminRow).order_by(AdminRow.username).all()
        ]
        sessions = [
            {"username": row.username, "session_hash": row.session_hash}
            for row in db.query(AdminSession).all()
        ] if "admin_sessions" in inspector.get_table_names() else []
    return {
        "revision": revision,
        "tables": inspector.get_table_names(),
        "session_columns": [column["name"] for column in inspector.get_columns("admin_sessions")] if "admin_sessions" in inspector.get_table_names() else [],
        "session_nullable": {column["name"]: column["nullable"] for column in inspector.get_columns("admin_sessions")} if "admin_sessions" in inspector.get_table_names() else {},
        "session_indexes": inspector.get_indexes("admin_sessions") if "admin_sessions" in inspector.get_table_names() else [],
        "admins": admins,
        "sessions": sessions,
    }


def table_exists(table_name):
    return table_name in inspect(SessionLocal.kw["bind"]).get_table_names()


class FakeSocket:
    def __init__(self, request: Request):
        self.cookies = request.cookies
        self.headers = request.headers
        self.query_params = {"interval": "1", "token": request.query_params.get("token", "")}
        self.accepted = False
        self.closed = None

    async def close(self, code=1000, reason=None):
        self.closed = {"code": code, "reason": reason}
        return self.closed

    async def accept(self):
        self.accepted = True

    async def receive(self):
        from starlette.websockets import WebSocketDisconnect
        raise WebSocketDisconnect(code=1000)


class FakeNode:
    connected = True

    def get_logs(self):
        @contextmanager
        def logs():
            yield deque()
        return logs()


app = FastAPI()
app.include_router(admin_router)


@app.get("/test/health")
def health():
    return {"ok": True}


@app.get("/api/test/protected")
def protected(admin: Admin = Depends(Admin.get_current)):
    return {"username": admin.username, "is_sudo": admin.is_sudo}


@app.post("/api/test/mutate")
def mutate(admin: Admin = Depends(Admin.get_current)):
    return {"changed_by": admin.username}


@app.get("/api/test/sudo")
def sudo(admin: Admin = Depends(Admin.check_sudo_admin)):
    return {"username": admin.username}


@app.post("/test/socket-auth/{kind}")
async def socket_auth_check(kind: str, request: Request, db: Session = Depends(get_db)):
    fake = FakeSocket(request)
    if kind == "core":
        import app.routers.core as core_router
        core_router.xray.core.get_logs = lambda: FakeNode().get_logs()
        await core_logs(fake, db)
    elif kind == "node":
        import app.routers.node as node_router
        node_router.xray.nodes[1] = FakeNode()
        await node_logs(1, fake, db)
    else:
        return {"error": "unknown socket kind"}
    return {"accepted": fake.accepted, "closed": fake.closed}


def seed_database():
    with SessionLocal() as db:
        for username, password, sudo in [("alice", "alice-pass", True), ("bob", "bob-pass", False)]:
            db.add(AdminRow(username=username, hashed_password=pwd_context.hash(password), is_sudo=sudo))
        db.commit()


async def asgi_request(request_data):
    url = urlsplit(request_data["url"])
    host = url.netloc
    headers = [(key.lower().encode("latin-1"), value.encode("latin-1")) for key, value in request_data.get("headers", {}).items()]
    if not any(key == b"host" for key, _ in headers):
        headers.append((b"host", host.encode("latin-1")))
    body = request_data.get("body", "").encode()
    body_delivered = False
    sent = []

    async def receive():
        nonlocal body_delivered
        if not body_delivered:
            body_delivered = True
            return {"type": "http.request", "body": body, "more_body": False}
        return {"type": "http.disconnect"}

    async def send(message):
        sent.append(message)

    scope = {
        "type": "http",
        "asgi": {"version": "3.0", "spec_version": "2.3"},
        "http_version": "1.1",
        "method": request_data.get("method", "GET").upper(),
        "scheme": url.scheme or "http",
        "path": url.path,
        "raw_path": url.path.encode("latin-1"),
        "query_string": url.query.encode("latin-1"),
        "root_path": "",
        "headers": headers,
        "server": (host.split(":")[0], int(host.split(":")[-1]) if ":" in host else 80),
        "client": ("127.0.0.1", 40000),
    }
    await app(scope, receive, send)
    response_start = next(message for message in sent if message["type"] == "http.response.start")
    response_body = b"".join(message.get("body", b"") for message in sent if message["type"] == "http.response.body")
    return {
        "status": response_start["status"],
        "headers": [[key.decode("latin-1"), value.decode("latin-1")] for key, value in response_start["headers"]],
        "body": response_body.decode("utf-8", errors="replace"),
    }


if __name__ == "__main__":
    if len(sys.argv) > 1 and sys.argv[1] == "inspect":
        import json
        print(json.dumps(inspect_database()))
    elif len(sys.argv) > 1 and sys.argv[1] == "has-sessions-table":
        print("true" if table_exists("admin_sessions") else "false")
    elif len(sys.argv) > 1 and sys.argv[1] == "seed":
        seed_database()
    elif len(sys.argv) > 1 and sys.argv[1] == "asgi":
        async def handle_lines():
            for line in sys.stdin:
                try:
                    result = await asgi_request(json.loads(line))
                    print(json.dumps(result), flush=True)
                except Exception as error:
                    print(json.dumps({"harness_error": repr(error)}), flush=True)
        asyncio.run(handle_lines())
    else:
        import uvicorn
        uvicorn.run(app, host="127.0.0.1", port=int(sys.argv[1]), log_level="warning")

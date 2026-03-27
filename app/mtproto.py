from __future__ import annotations

import json
import logging
from datetime import datetime
from hashlib import sha256
from pathlib import Path
from urllib.parse import urlencode

from app.db import GetDB
from app.db import models as db_models
from app.models.user import UserStatus
from app.utils.jwt import get_secret_key
from config import (
    MTPROTO_BIND_TO,
    MTPROTO_CONFIG_PATH,
    MTPROTO_PUBLIC_HOST,
    MTPROTO_PUBLIC_PORT,
    MTPROTO_SECRET_MODE,
    MTPROTO_STATS_BIND_TO,
    MTPROTO_TLS_DOMAIN,
)

logger = logging.getLogger("uvicorn.error")


def status_has_mtproto_access(status: UserStatus) -> bool:
    return status in (UserStatus.active, UserStatus.on_hold)


def mtproto_password(
    user_id: int,
    username: str,
    sub_revoked_at: datetime | None = None,
) -> str:
    # Use the same revocation-sensitive source material pattern as SOCKS5.
    revoked_at = int(sub_revoked_at.timestamp()) if sub_revoked_at else 0
    raw = f"{user_id}:{username}:{revoked_at}:{get_secret_key()}:mtproto"
    return sha256(raw.encode()).hexdigest()[:32]


def mtproto_secret(
    user_id: int,
    username: str,
    sub_revoked_at: datetime | None = None,
) -> str:
    password = mtproto_password(user_id, username, sub_revoked_at)
    mode = MTPROTO_SECRET_MODE.lower().strip()

    if mode == "dd":
        return f"dd{password}"

    if mode == "ee":
        domain = MTPROTO_TLS_DOMAIN.strip()
        if not domain:
            raise ValueError(
                "MTPROTO_TLS_DOMAIN must be set when MTPROTO_SECRET_MODE=ee"
            )
        return f"ee{password}{domain.encode('utf-8').hex()}"

    raise ValueError("MTPROTO_SECRET_MODE must be either 'dd' or 'ee'")


def build_tg_mtproto_link(server: str, port: int, secret: str) -> str:
    params = urlencode(
        {
            "server": server,
            "port": str(port),
            "secret": secret,
        }
    )
    return f"tg://proxy?{params}"


def _quoted_toml(value: str) -> str:
    return json.dumps(value)


def _dummy_secret() -> str:
    raw = sha256(f"mtproto-dummy:{get_secret_key()}".encode()).hexdigest()[:32]
    return f"dd{raw}"


def _bind_port() -> int:
    bind_to = MTPROTO_BIND_TO.strip()
    if not bind_to or ":" not in bind_to:
        raise ValueError("MTPROTO_BIND_TO must be in host:port format")
    return int(bind_to.rsplit(":", 1)[1])


def get_mtproto_public_endpoint(request_host: str | None = None) -> tuple[str, int]:
    host = MTPROTO_PUBLIC_HOST.strip() or (request_host or "").strip()
    if not host:
        host = "SERVER_PUBLIC_DOMAIN"

    port = MTPROTO_PUBLIC_PORT or _bind_port()
    return host, port


def is_mtproto_enabled() -> bool:
    return bool(MTPROTO_BIND_TO.strip() and MTPROTO_CONFIG_PATH.strip())


def render_mtproto_config() -> str:
    if not is_mtproto_enabled():
        raise ValueError("MTProto is not configured")

    with GetDB() as db:
        users = (
            db.query(
                db_models.User.id,
                db_models.User.username,
                db_models.User.sub_revoked_at,
            )
            .filter(
                db_models.User.status.in_([UserStatus.active, UserStatus.on_hold])
            )
            .order_by(db_models.User.id.asc())
            .all()
        )

    lines = [f"bind-to = {_quoted_toml(MTPROTO_BIND_TO.strip())}"]

    stats_bind_to = MTPROTO_STATS_BIND_TO.strip()
    if stats_bind_to:
        lines.append(f"api-bind-to = {_quoted_toml(stats_bind_to)}")

    lines.extend(["", "[secrets]"])
    lines.append(f'"__disabled__" = {_quoted_toml(_dummy_secret())}')

    for user in users:
        lines.append(
            f"{_quoted_toml(user.username)} = "
            f"{_quoted_toml(mtproto_secret(user.id, user.username, user.sub_revoked_at))}"
        )

    lines.append("")
    return "\n".join(lines)


def sync_mtproto_config() -> None:
    if not is_mtproto_enabled():
        return

    path = Path(MTPROTO_CONFIG_PATH)
    path.parent.mkdir(parents=True, exist_ok=True)
    config_text = render_mtproto_config()

    tmp_path = path.with_suffix(path.suffix + ".tmp")
    tmp_path.write_text(config_text, encoding="utf-8")
    tmp_path.replace(path)

    logger.info("MTProto config synced to %s", path)

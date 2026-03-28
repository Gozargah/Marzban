from __future__ import annotations

import logging
from datetime import datetime
from hashlib import sha256
from urllib.parse import urlencode

from app.db import GetDB, crud
from app.db import models as db_models
from app.models.user import UserStatus
from app.utils.jwt import get_secret_key
from config import (
    MTPROTO_NODE_NAME,
    MTPROTO_PUBLIC_HOST,
    MTPROTO_PUBLIC_PORT,
    MTPROTO_SECRET_MODE,
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
    revoked_at = int(sub_revoked_at.timestamp()) if sub_revoked_at else 0
    raw = f"{user_id}:{username}:{revoked_at}:{get_secret_key()}:mtproto"
    return sha256(raw.encode()).hexdigest()[:32]


def mtproto_secret(
    user_id: int,
    username: str,
    sub_revoked_at: datetime | None = None,
) -> str:
    password = mtproto_password(user_id, username, sub_revoked_at)
    mode = _secret_mode()

    if mode == "dd":
        return f"dd{password}"

    domain = _tls_domain()
    return f"ee{password}{domain.encode('utf-8').hex()}"


def _secret_mode() -> str:
    mode = MTPROTO_SECRET_MODE.lower().strip()
    if mode not in {"dd", "ee"}:
        raise ValueError("MTPROTO_SECRET_MODE must be either 'dd' or 'ee'")
    return mode


def _tls_domain() -> str:
    domain = MTPROTO_TLS_DOMAIN.strip()
    if not domain:
        raise ValueError("MTPROTO_TLS_DOMAIN must be set when MTPROTO_SECRET_MODE=ee")
    return domain


def build_tg_mtproto_link(server: str, port: int, secret: str) -> str:
    params = urlencode(
        {
            "server": server,
            "port": str(port),
            "secret": secret,
        }
    )
    return f"tg://proxy?{params}"


def get_mtproto_public_endpoint(request_host: str | None = None) -> tuple[str, int]:
    host = MTPROTO_PUBLIC_HOST.strip() or (request_host or "").strip()
    if not host:
        host = "SERVER_PUBLIC_DOMAIN"

    return host, MTPROTO_PUBLIC_PORT


def is_mtproto_enabled() -> bool:
    return bool(
        MTPROTO_NODE_NAME.strip() and MTPROTO_PUBLIC_HOST.strip() and MTPROTO_PUBLIC_PORT
    )


def _get_mtproto_sync_users() -> list[dict[str, str]]:
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

    return [
        {
            "username": user.username,
            "secret": mtproto_password(user.id, user.username, user.sub_revoked_at),
        }
        for user in users
    ]


def build_mtproto_sync_payload() -> dict[str, list[dict[str, str]]]:
    return {"users": _get_mtproto_sync_users()}


def _expected_mtproto_node_runtime() -> dict[str, str | int]:
    return {
        "mode": _secret_mode(),
        "domain": MTPROTO_PUBLIC_HOST.strip(),
        "port": MTPROTO_PUBLIC_PORT,
    }


def _mtproto_runtime_matches_node(status: dict) -> tuple[bool, str | None]:
    expected = _expected_mtproto_node_runtime()
    for field, expected_value in expected.items():
        actual_value = status.get(field)
        if actual_value != expected_value:
            return (
                False,
                f'{field} mismatch (host={expected_value!r}, node={actual_value!r})',
            )
    return True, None


def sync_mtproto_node(node_id: int | None = None) -> None:
    if not is_mtproto_enabled():
        return

    target_node_name = MTPROTO_NODE_NAME.strip()
    with GetDB() as db:
        dbnode = crud.get_node(db, target_node_name)

    if not dbnode:
        logger.warning('MTProto target node "%s" was not found', target_node_name)
        return

    if node_id is not None and dbnode.id != node_id:
        return

    from app import xray

    node = xray.nodes.get(dbnode.id)
    if not node or not node.connected:
        logger.info(
            'Skipping MTProto sync: target node "%s" is not connected',
            target_node_name,
        )
        return

    if not hasattr(node, "apply_mtproto_users"):
        logger.warning(
            'Skipping MTProto sync: node "%s" does not support MTProto sync',
            target_node_name,
        )
        return

    if hasattr(node, "get_mtproto_status"):
        try:
            status = node.get_mtproto_status()
        except Exception as exc:
            detail = getattr(exc, "detail", str(exc))
            logger.warning(
                'Skipping MTProto sync: failed to fetch runtime status from node "%s": %s',
                target_node_name,
                detail,
            )
            return

        is_valid, reason = _mtproto_runtime_matches_node(status)
        if not is_valid:
            logger.warning(
                'Skipping MTProto sync: runtime mismatch on node "%s": %s',
                target_node_name,
                reason,
            )
            return

    payload = build_mtproto_sync_payload()
    try:
        node.apply_mtproto_users(payload["users"])
    except Exception as exc:
        detail = getattr(exc, "detail", str(exc))
        logger.warning(
            'Failed to sync MTProto config to node "%s": %s',
            target_node_name,
            detail,
        )
        return

    logger.info(
        'MTProto config synced to node "%s" with %d users',
        target_node_name,
        len(payload["users"]),
    )

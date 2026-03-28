from dataclasses import dataclass
from datetime import datetime
from functools import lru_cache
from typing import TYPE_CHECKING

from sqlalchemy.exc import SQLAlchemyError

from app import logger, xray
from app.db import GetDB, crud
from app.models.node import NodeStatus
from app.models.proxy import ProxyTypes
from app.models.user import UserResponse, UserStatus
from app.mtproto import sync_mtproto_node
from app.utils.hysteria_cache import invalidate_hysteria_cache
from app.utils.concurrency import threaded_function
from app.xray.node import XRayNode
from app.xray.socks import socks5_password, socks5_username
from xray_api import XRay as XRayAPI
from xray_api.types.account import Account, SocksAccount, XTLSFlows

if TYPE_CHECKING:
    from app.db import User as DBUser
    from app.db.models import Node as DBNode


@lru_cache(maxsize=None)
def get_tls():
    from app.db import GetDB, get_tls_certificate
    with GetDB() as db:
        tls = get_tls_certificate(db)
        return {
            "key": tls.key,
            "certificate": tls.certificate
        }


@threaded_function
def _add_user_to_inbound(api: XRayAPI, inbound_tag: str, account: Account):
    try:
        api.add_inbound_user(tag=inbound_tag, user=account, timeout=30)
    except (xray.exc.EmailExistsError, xray.exc.ConnectionError):
        pass


@threaded_function
def _remove_user_from_inbound(api: XRayAPI, inbound_tag: str, email: str):
    try:
        api.remove_inbound_user(tag=inbound_tag, email=email, timeout=30)
    except (xray.exc.EmailNotFoundError, xray.exc.ConnectionError):
        pass


@threaded_function
def _alter_inbound_user(api: XRayAPI, inbound_tag: str, account: Account):
    try:
        api.remove_inbound_user(tag=inbound_tag, email=account.email, timeout=30)
    except (xray.exc.EmailNotFoundError, xray.exc.ConnectionError):
        pass
    try:
        api.add_inbound_user(tag=inbound_tag, user=account, timeout=30)
    except (xray.exc.EmailExistsError, xray.exc.ConnectionError):
        pass


@dataclass(frozen=True)
class UserSyncState:
    user_id: int
    username: str
    status: UserStatus | str
    sub_revoked_at: datetime | None = None

    @classmethod
    def from_user(cls, user):
        return cls(
            user_id=user.id,
            username=user.username,
            status=user.status,
            sub_revoked_at=getattr(user, "sub_revoked_at", None),
        )


def _status_has_socks_access(status: UserStatus | str) -> bool:
    return status in (UserStatus.active, UserStatus.on_hold)


def _socks_email(user: UserSyncState) -> str:
    return f"{user.user_id}.{user.username}"


def _socks_account(user: UserSyncState) -> SocksAccount:
    return SocksAccount(
        email=_socks_email(user),
        username=socks5_username(user.username),
        password=socks5_password(user.user_id, user.username, user.sub_revoked_at),
    )


def _apply_socks_add(user: UserSyncState) -> None:
    account = _socks_account(user)
    for inbound_tag in xray.config.socks_inbounds_by_tag:
        _add_user_to_inbound(xray.api, inbound_tag, account)
        for node in list(xray.nodes.values()):
            if node.connected and node.started:
                _add_user_to_inbound(node.api, inbound_tag, account)


def _apply_socks_remove(user: UserSyncState) -> None:
    email = _socks_email(user)
    for inbound_tag in xray.config.socks_inbounds_by_tag:
        _remove_user_from_inbound(xray.api, inbound_tag, email)
        for node in list(xray.nodes.values()):
            if node.connected and node.started:
                _remove_user_from_inbound(node.api, inbound_tag, email)


def _apply_socks_alter(current: UserSyncState, previous: UserSyncState) -> None:
    old_email = _socks_email(previous)
    account = _socks_account(current)
    for inbound_tag in xray.config.socks_inbounds_by_tag:
        if old_email == account.email:
            _alter_inbound_user(xray.api, inbound_tag, account)
            for node in list(xray.nodes.values()):
                if node.connected and node.started:
                    _alter_inbound_user(node.api, inbound_tag, account)
            continue

        _remove_user_from_inbound(xray.api, inbound_tag, old_email)
        _add_user_to_inbound(xray.api, inbound_tag, account)
        for node in list(xray.nodes.values()):
            if node.connected and node.started:
                _remove_user_from_inbound(node.api, inbound_tag, old_email)
                _add_user_to_inbound(node.api, inbound_tag, account)


def _sync_socks_on_add(dbuser: "DBUser") -> bool:
    if not xray.config.socks_inbounds_by_tag:
        return False

    current = UserSyncState.from_user(dbuser)
    if not _status_has_socks_access(current.status):
        return False

    _apply_socks_add(current)
    return True


def _sync_socks_on_remove(
    dbuser: "DBUser",
    previous_sync_state: UserSyncState | None = None,
) -> bool:
    if not xray.config.socks_inbounds_by_tag:
        return False

    previous = previous_sync_state or UserSyncState.from_user(dbuser)
    if not _status_has_socks_access(previous.status):
        return False

    _apply_socks_remove(previous)
    return True


def _sync_socks_on_update(
    dbuser: "DBUser",
    previous_sync_state: UserSyncState | None = None,
) -> bool:
    if not xray.config.socks_inbounds_by_tag:
        return False

    current = UserSyncState.from_user(dbuser)
    previous = previous_sync_state

    if previous is None:
        if not _status_has_socks_access(current.status):
            return False
        _apply_socks_alter(current, current)
        return True

    current_access = _status_has_socks_access(current.status)
    previous_access = _status_has_socks_access(previous.status)

    if previous_access and not current_access:
        _apply_socks_remove(previous)
        return True

    if not previous_access and current_access:
        _apply_socks_add(current)
        return True

    if not previous_access and not current_access:
        return False

    if (
        previous.username == current.username
        and previous.sub_revoked_at == current.sub_revoked_at
    ):
        return False

    _apply_socks_alter(current, previous)
    return True


def restart_all_cores(config=None, sync_mtproto: bool = True):
    if config is None:
        config = xray.config.include_db_users()

    xray.core.restart(config)
    for node_id, node in list(xray.nodes.items()):
        if node.connected:
            restart_node(node_id, config, sync_mtproto=sync_mtproto)


def sync_socks_accounts():
    if not xray.config.socks_inbounds_by_tag:
        return

    restart_all_cores()


def _needs_config_reload(proxy_type) -> bool:
    """Protocols that have no gRPC API support require a full config reload."""
    return proxy_type.account_model is None


def add_user(
    dbuser: "DBUser",
    sync_socks: bool = True,
    sync_mtproto: bool = True,
):
    user = UserResponse.model_validate(dbuser)
    email = f"{dbuser.id}.{dbuser.username}"
    has_reload_protocol = False

    for proxy_type, inbound_tags in user.inbounds.items():
        if proxy_type.is_external:
            continue  # Handled by external service (e.g., hysteriad); no Xray action needed

        if _needs_config_reload(proxy_type):
            has_reload_protocol = True
            continue

        for inbound_tag in inbound_tags:
            inbound = xray.config.inbounds_by_tag.get(inbound_tag, {})

            try:
                proxy_settings = user.proxies[proxy_type].dict(no_obj=True)
            except KeyError:
                pass
            account = proxy_type.account_model(email=email, **proxy_settings)

            # XTLS currently only supports transmission methods of TCP and mKCP
            if getattr(account, 'flow', None) and (
                inbound.get('network', 'tcp') not in ('tcp', 'kcp')
                or
                (
                    inbound.get('network', 'tcp') in ('tcp', 'kcp')
                    and
                    inbound.get('tls') not in ('tls', 'reality')
                )
                or
                inbound.get('header_type') == 'http'
            ):
                account.flow = XTLSFlows.NONE

            _add_user_to_inbound(xray.api, inbound_tag, account)  # main core
            for node in list(xray.nodes.values()):
                if node.connected and node.started:
                    _add_user_to_inbound(node.api, inbound_tag, account)

    invalidate_hysteria_cache()

    if sync_socks:
        _sync_socks_on_add(dbuser)

    if has_reload_protocol:
        restart_all_cores(sync_mtproto=sync_mtproto)
    elif sync_mtproto:
        sync_mtproto_node()


def remove_user(
    dbuser: "DBUser",
    sync_socks: bool = True,
    sync_mtproto: bool = True,
    previous_sync_state: UserSyncState | None = None,
):
    email = f"{dbuser.id}.{dbuser.username}"
    has_reload_protocol = False

    for inbound_tag, inbound in xray.config.inbounds_by_tag.items():
        protocol = inbound.get('protocol', '')
        try:
            proxy_type = ProxyTypes(protocol)
            if proxy_type.is_external:
                continue  # External service; no Xray action needed
            if _needs_config_reload(proxy_type):
                has_reload_protocol = True
                continue
        except ValueError:
            pass

        _remove_user_from_inbound(xray.api, inbound_tag, email)
        for node in list(xray.nodes.values()):
            if node.connected and node.started:
                _remove_user_from_inbound(node.api, inbound_tag, email)

    invalidate_hysteria_cache()

    if sync_socks:
        _sync_socks_on_remove(dbuser, previous_sync_state=previous_sync_state)

    if has_reload_protocol:
        restart_all_cores(sync_mtproto=sync_mtproto)
    elif sync_mtproto:
        sync_mtproto_node()


def update_user(
    dbuser: "DBUser",
    sync_socks: bool = True,
    sync_mtproto: bool = True,
    previous_sync_state: UserSyncState | None = None,
):
    user = UserResponse.model_validate(dbuser)
    email = f"{dbuser.id}.{dbuser.username}"
    has_reload_protocol = False

    active_inbounds = []
    for proxy_type, inbound_tags in user.inbounds.items():
        if proxy_type.is_external:
            # Mark as active to prevent removal attempt; no Xray action needed
            active_inbounds.extend(inbound_tags)
            continue

        if _needs_config_reload(proxy_type):
            has_reload_protocol = True
            active_inbounds.extend(inbound_tags)
            continue

        for inbound_tag in inbound_tags:
            active_inbounds.append(inbound_tag)
            inbound = xray.config.inbounds_by_tag.get(inbound_tag, {})

            try:
                proxy_settings = user.proxies[proxy_type].dict(no_obj=True)
            except KeyError:
                pass
            account = proxy_type.account_model(email=email, **proxy_settings)

            # XTLS currently only supports transmission methods of TCP and mKCP
            if getattr(account, 'flow', None) and (
                inbound.get('network', 'tcp') not in ('tcp', 'kcp')
                or
                (
                    inbound.get('network', 'tcp') in ('tcp', 'kcp')
                    and
                    inbound.get('tls') not in ('tls', 'reality')
                )
                or
                inbound.get('header_type') == 'http'
            ):
                account.flow = XTLSFlows.NONE

            _alter_inbound_user(xray.api, inbound_tag, account)  # main core
            for node in list(xray.nodes.values()):
                if node.connected and node.started:
                    _alter_inbound_user(node.api, inbound_tag, account)

    for inbound_tag in xray.config.inbounds_by_tag:
        if inbound_tag in active_inbounds:
            continue
        inbound = xray.config.inbounds_by_tag[inbound_tag]
        protocol = inbound.get('protocol', '')
        try:
            if ProxyTypes(protocol).is_external:
                continue  # External inbound; Xray doesn't manage its clients
        except ValueError:
            pass
        # remove disabled inbounds
        _remove_user_from_inbound(xray.api, inbound_tag, email)
        for node in list(xray.nodes.values()):
            if node.connected and node.started:
                _remove_user_from_inbound(node.api, inbound_tag, email)

    invalidate_hysteria_cache()

    if sync_socks:
        _sync_socks_on_update(dbuser, previous_sync_state=previous_sync_state)

    if has_reload_protocol:
        restart_all_cores(sync_mtproto=sync_mtproto)
    elif sync_mtproto:
        sync_mtproto_node()


def remove_node(node_id: int):
    if node_id in xray.nodes:
        try:
            xray.nodes[node_id].disconnect()
        except Exception:
            pass
        finally:
            try:
                del xray.nodes[node_id]
            except KeyError:
                pass


def add_node(dbnode: "DBNode"):
    remove_node(dbnode.id)

    tls = get_tls()
    xray.nodes[dbnode.id] = XRayNode(address=dbnode.address,
                                     port=dbnode.port,
                                     api_port=dbnode.api_port,
                                     ssl_key=tls['key'],
                                     ssl_cert=tls['certificate'],
                                     usage_coefficient=dbnode.usage_coefficient)

    return xray.nodes[dbnode.id]


def _change_node_status(node_id: int, status: NodeStatus, message: str = None, version: str = None):
    with GetDB() as db:
        try:
            dbnode = crud.get_node_by_id(db, node_id)
            if not dbnode:
                return

            if dbnode.status == NodeStatus.disabled:
                remove_node(dbnode.id)
                return

            crud.update_node_status(db, dbnode, status, message, version)
        except SQLAlchemyError:
            db.rollback()


global _connecting_nodes
_connecting_nodes = {}


@threaded_function
def connect_node(node_id, config=None):
    global _connecting_nodes

    if _connecting_nodes.get(node_id):
        return

    with GetDB() as db:
        dbnode = crud.get_node_by_id(db, node_id)

    if not dbnode:
        return

    try:
        node = xray.nodes[dbnode.id]
        assert node.connected
    except (KeyError, AssertionError):
        node = xray.operations.add_node(dbnode)

    try:
        _connecting_nodes[node_id] = True

        _change_node_status(node_id, NodeStatus.connecting)
        logger.info(f"Connecting to \"{dbnode.name}\" node")

        if config is None:
            config = xray.config.include_db_users()

        node.start(config)
        version = node.get_version()
        _change_node_status(node_id, NodeStatus.connected, version=version)
        sync_mtproto_node(node_id=dbnode.id)
        logger.info(f"Connected to \"{dbnode.name}\" node, xray run on v{version}")

    except Exception as e:
        _change_node_status(node_id, NodeStatus.error, message=str(e))
        logger.info(f"Unable to connect to \"{dbnode.name}\" node")

    finally:
        try:
            del _connecting_nodes[node_id]
        except KeyError:
            pass


@threaded_function
def restart_node(node_id, config=None, sync_mtproto: bool = True):
    with GetDB() as db:
        dbnode = crud.get_node_by_id(db, node_id)

    if not dbnode:
        return

    try:
        node = xray.nodes[dbnode.id]
    except KeyError:
        node = xray.operations.add_node(dbnode)

    if not node.connected:
        return connect_node(node_id, config)

    try:
        logger.info(f"Restarting Xray core of \"{dbnode.name}\" node")

        if config is None:
            config = xray.config.include_db_users()

        node.restart(config)
        if sync_mtproto:
            sync_mtproto_node(node_id=dbnode.id)
        logger.info(f"Xray core of \"{dbnode.name}\" node restarted")
    except Exception as e:
        _change_node_status(node_id, NodeStatus.error, message=str(e))
        logger.info(f"Unable to restart node {node_id}")
        try:
            node.disconnect()
        except Exception:
            pass


__all__ = [
    "add_user",
    "remove_user",
    "update_user",
    "sync_socks_accounts",
    "restart_all_cores",
    "UserSyncState",
    "add_node",
    "remove_node",
    "connect_node",
    "restart_node",
]

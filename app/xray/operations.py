from functools import lru_cache
from typing import TYPE_CHECKING

from sqlalchemy.exc import SQLAlchemyError

from app import logger, xray
from app.db import GetDB, crud
from app.models.node import NodeStatus
from app.models.user import UserResponse
from app.utils.concurrency import threaded_function
from app.xray.node import XRayNode
from xray_api import XRay as XRayAPI
from xray_api.types.account import Account, XTLSFlows
from threading import Lock

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


def _process_user_inbounds(dbuser: "DBUser", action: str):
    user = UserResponse.model_validate(dbuser)
    email = f"{dbuser.id}.{dbuser.username}"

    for proxy_type, inbound_tags in user.inbounds.items():
        for inbound_tag in inbound_tags:
            inbound = xray.config.inbounds_by_tag.get(inbound_tag, {})
            proxy_settings = user.proxies.get(proxy_type)
            if not proxy_settings:
                continue

            account = proxy_type.account_model(email=email, **proxy_settings.dict(no_obj=True))
            if getattr(account, 'flow', None) and (inbound.get('network', 'tcp') not in ('tcp', 'raw', 'kcp')
                                                   or inbound.get('tls') not in ('tls', 'reality')
                                                   or inbound.get('header_type') == 'http'):
                account.flow = XTLSFlows.NONE

            func_map = {
                "add": _add_user_to_inbound,
                "update": _alter_inbound_user,
                "remove": _remove_user_from_inbound
            }

            func_map[action](xray.api, inbound_tag, account if action != "remove" else email)

            for node in xray.nodes.values():
                if node.connected and node.started:
                    func_map[action](node.api, inbound_tag, account if action != "remove" else email)

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


def add_user(dbuser: "DBUser"):
    _process_user_inbounds(dbuser, "add")


def remove_user(dbuser: "DBUser"):
    _process_user_inbounds(dbuser, "remove")


def update_user(dbuser: "DBUser"):
    _process_user_inbounds(dbuser, "update")


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


_connecting_nodes = set()
_connecting_nodes_lock = Lock()


@threaded_function
def connect_node(node_id, config=None):
    global _connecting_nodes, _connecting_nodes_lock

    with _connecting_nodes_lock:
        if node_id in _connecting_nodes:
            logger.debug(f"Node {node_id} is already connecting. Skipping.")
            return
        _connecting_nodes.add(node_id)

    try:
        with GetDB() as db:
            dbnode = crud.get_node_by_id(db, node_id)
            if not dbnode:
                logger.error(f"Node {node_id} not found in the database.")
                return

        for attempt in range(3):
            try:
                node = xray.nodes.get(dbnode.id) or xray.operations.add_node(dbnode)
                _change_node_status(node_id, NodeStatus.connecting)

                logger.info(f"Connecting to node {dbnode.name} (attempt {attempt + 1})")
                config = config or xray.config.include_db_users()
                node.start(config)

                version = node.get_version()
                _change_node_status(node_id, NodeStatus.connected, version=version)
                logger.info(f"Connected to {dbnode.name}, XRay v{version}")
                break
            except (xray.exc.ConnectionError, SQLAlchemyError) as e:
                if attempt == 2:
                    _change_node_status(node_id, NodeStatus.error, message=str(e))
                    logger.error(f"Failed to connect after 3 attempts: {e}")

    finally:
        with _connecting_nodes_lock:
            _connecting_nodes.discard(node_id)

@threaded_function
def restart_node(node_id, config=None):
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
    "add_node",
    "remove_node",
    "connect_node",
    "restart_node",
]

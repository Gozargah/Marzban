from sqlalchemy.exc import SQLAlchemyError

from app import logger, xray
from app.db import GetDB, User, crud
from app.db.models import Node as DBNode
from app.models.node import NodeStatus
from app.models.user import User, UserResponse
from app.xray.node import XRayNode


def add_user(user: User):
    if not isinstance(user, User):
        user = UserResponse.from_orm(user)
    for proxy_type, inbound_tags in user.inbounds.items():
        account = user.get_account(proxy_type)
        for inbound_tag in inbound_tags:
            try:
                xray.api.add_inbound_user(tag=inbound_tag, user=account)
            except xray.exc.EmailExistsError:
                pass

    config = xray.config.include_db_users()
    for node in xray.nodes.values():
        node.restart(config)


def remove_user(user: User):
    for inbound_tag in xray.config.inbounds_by_tag:
        try:
            xray.api.remove_inbound_user(tag=inbound_tag, email=user.username)
        except xray.exc.EmailNotFoundError:
            pass

    config = xray.config.include_db_users()
    for node in xray.nodes.values():
        node.restart(config)


def remove_node(node_id: int):
    if node_id in xray.nodes:
        try:
            xray.nodes[node_id].disconnect()
        except Exception:
            pass
        finally:
            del xray.nodes[node_id]


def add_node(dbnode: DBNode):
    remove_node(dbnode.id)

    xray.nodes[dbnode.id] = XRayNode(address=dbnode.address,
                                     port=dbnode.port,
                                     api_port=dbnode.api_port,
                                     ssl_cert=dbnode.certificate,
                                     name = dbnode.name)

    return xray.nodes[dbnode.id]


def connect_node(node_id, config):

    with GetDB() as db:
        dbnode = crud.get_node_by_id(db, node_id)
        if not dbnode:
            return

        try:
            node = xray.nodes[dbnode.id]
        except KeyError:
            node = xray.operations.add_node(dbnode)
        try:
            crud.update_node_status(db, dbnode, NodeStatus.connecting)
        except SQLAlchemyError:
            pass

        try:
            logger.info(f"Connecting to \"{dbnode.name}\" node")
            node.start(config)
            message = None
            status = NodeStatus.connected
            logger.info(f"Connected to \"{dbnode.name}\" node")
        except Exception as e:
            message = str(e)
            status = NodeStatus.error
            logger.info(f"Unable to connect to \"{dbnode.name}\" node")
        finally:
            try:
                crud.update_node_status(db, dbnode, status, message)
            except SQLAlchemyError:
                pass


__all__ = [
    "add_user",
    "remove_user",
]

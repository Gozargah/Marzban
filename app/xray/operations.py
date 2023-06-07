from sqlalchemy.exc import SQLAlchemyError
from threading import Thread

from app import logger, xray
from app.db import GetDB
from app.db import User as DBUser
from app.db import crud
from app.db.models import Node as DBNode
from app.models.node import NodeStatus
from app.models.user import UserResponse
from app.models.proxy import ProxyTypes
from app.utils.concurrency import threaded_function
from app.xray.node import XRayNode
from xray_api.types.account import XTLSFlows

def add_inbound_user(dbuser: DBUser, node_id: int, inbound_tag: str, proxy_type: ProxyTypes):
    user = UserResponse.from_orm(dbuser)
    inbound = xray.config.inbounds_by_tag.get(inbound_tag, {})
    try:
        proxy_settings = user.proxies[proxy_type].dict(no_obj=True)
    except KeyError:
        pass
    account = proxy_type.account_model(email=f"{dbuser.id}.{dbuser.username}", **proxy_settings)

    # XTLS currently only supports transmission methods of TCP and mKCP
    if inbound.get('network', 'tcp') not in ('tcp', 'kcp') and getattr(account, 'flow', None):
        account.flow = XTLSFlows.NONE

    if node_id == 0:
        try:
            xray.api.add_inbound_user(tag=inbound_tag, user=account)
        except (xray.exc.EmailExistsError, xray.exc.ConnectionError):
            pass
    else:
        try:
            xray.nodes[node_id].api.add_inbound_user(tag=inbound_tag, user=account)
        except (xray.exc.EmailExistsError, xray.exc.ConnectionError):
            pass

def add_user(dbuser: DBUser):
    user = UserResponse.from_orm(dbuser)

    threads: list[Thread] = []

    for proxy_type, inbound_tags in user.inbounds.items():
        for inbound_tag in inbound_tags:
            job_thread = Thread(target=add_inbound_user, args=(dbuser, 0, inbound_tag, proxy_type), daemon=True)
            job_thread.start()
            threads.append(job_thread)

    for node_id, node in xray.nodes.copy().items():
        if node.connected and node.started:
            for proxy_type, inbound_tags in user.inbounds.items():
                for inbound_tag in inbound_tags:
                    job_thread = Thread(target=add_inbound_user, args=(dbuser, node_id, inbound_tag, proxy_type), daemon=True)
                    job_thread.start()
                    threads.append(job_thread)
    
    for job_thread in threads:
        job_thread.join()


def remove_inbound_user(dbuser: DBUser, node_id: int, inbound_tag: str):
    if node_id == 0:
        try:
            xray.api.remove_inbound_user(tag=inbound_tag, email=f"{dbuser.id}.{dbuser.username}")
        except (xray.exc.EmailNotFoundError, xray.exc.ConnectionError):
            pass
    else:
        try:
            xray.nodes[node_id].api.remove_inbound_user(tag=inbound_tag, email=f"{dbuser.id}.{dbuser.username}")
        except (xray.exc.EmailNotFoundError, xray.exc.ConnectionError):
            pass

def remove_user(dbuser: DBUser):
    threads: list[Thread] = []

    for inbound_tag in xray.config.inbounds_by_tag:
        job_thread = Thread(target=remove_inbound_user, args=(dbuser, 0, inbound_tag))
        job_thread.start()
        threads.append(job_thread)
        
    for node_id, node in xray.nodes.copy().items():
        if node.connected and node.started:
            for inbound_tag in xray.config.inbounds_by_tag:
                job_thread = Thread(target=remove_inbound_user, args=(dbuser, node_id, inbound_tag))
                job_thread.start()
                threads.append(job_thread)

    for job_thread in threads:
        job_thread.join()



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
                                     ssl_cert=dbnode.certificate)

    return xray.nodes[dbnode.id]


@threaded_function
def connect_node(node_id, config):

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
            crud.update_node_status(db, dbnode, NodeStatus.connecting)
        except SQLAlchemyError:
            db.rollback()

        try:
            logger.info(f"Connecting to \"{dbnode.name}\" node")
            node.start(config)
            message = None
            status = NodeStatus.connected
            version = node.remote.fetch_xray_version()
            logger.info(f"Connected to \"{dbnode.name}\" node, xray run on v{version}")
        except Exception as e:
            message = str(e)
            status = NodeStatus.error
            version = ""
            logger.info(f"Unable to connect to \"{dbnode.name}\" node")

        finally:
            try:
                crud.update_node_status(db, dbnode, status, message, version)
            except SQLAlchemyError:
                db.rollback()


@threaded_function
def restart_node(node_id, config):

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
            logger.info(f"Restarting \"{dbnode.name}\" node")
            if node.started:
                node.restart(config)
            else:
                node.start(config)
            message = None
            status = NodeStatus.connected
            version = node.remote.fetch_xray_version()
            logger.info(f"Node \"{dbnode.name}\" restarted, xray run on v{version}")
        except Exception as e:
            message = str(e)
            status = NodeStatus.error
            version = ""
            logger.info(f"Unable to restart \"{dbnode.name}\" node")

        finally:
            try:
                crud.update_node_status(db, dbnode, status, message, version)
            except SQLAlchemyError:
                db.rollback()


__all__ = [
    "add_user",
    "remove_user",
    "add_node",
    "remove_node",
    "connect_node",
    "restart_node",
]

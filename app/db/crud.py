from enum import Enum
from typing import List, Tuple, Union

from app.db.models import (JWT, Admin, Proxy, ProxyHost, ProxyInbound, System,
                           User, UserUsageResetLogs)
from app.models.admin import AdminCreate, AdminModify
from app.models.proxy import ProxyHost as ProxyHostModify
from app.models.user import (UserCreate, UserDataLimitResetStrategy,
                             UserModify, UserStatus)
from sqlalchemy.orm import Session


def get_or_create_inbound(db: Session, inbound_tag: str):
    inbound = db.query(ProxyInbound).filter(ProxyInbound.tag == inbound_tag).first()
    if not inbound:
        inbound = ProxyInbound(tag=inbound_tag)
        db.add(inbound)
        host = ProxyHost(remark="🚀 Marz", address="{SERVER_IP}", inbound=inbound)
        db.add(host)
        db.commit()
        db.refresh(inbound)
    return inbound


def get_hosts(db: Session, inbound_tag: str):
    inbound = get_or_create_inbound(db, inbound_tag)
    return inbound.hosts


def update_hosts(db: Session, inbound_tag: str, modified_hosts: List[ProxyHostModify]):
    inbound = get_or_create_inbound(db, inbound_tag)
    inbound.hosts = [
        ProxyHost(
            remark=host.remark,
            address=host.address,
            port=host.port,
            sni=host.sni,
            host=host.host,
            inbound=inbound
        ) for host in modified_hosts
    ]
    db.commit()
    db.refresh(inbound)
    return inbound.hosts


def get_user(db: Session, username: str):
    return db.query(User).filter(User.username == username).first()


def get_user_by_id(db: Session, user_id: int):
    return db.query(User).filter(User.id == user_id).first()


UsersSortingOptions = Enum('UsersSortingOptions', {
    'username': User.username.asc(),
    'used_traffic': User.used_traffic.asc(),
    'data_limit': User.data_limit.asc(),
    'expire': User.expire.asc(),
    'created_at': User.created_at.asc(),
    '-username': User.username.desc(),
    '-used_traffic': User.used_traffic.desc(),
    '-data_limit': User.data_limit.desc(),
    '-expire': User.expire.desc(),
    '-created_at': User.created_at.desc(),
})


def get_users(db: Session,
              offset: int = None,
              limit: int = None,
              username: str = None,
              status: Union[UserStatus, list] = None,
              sort: List[UsersSortingOptions] = None,
              admin: Admin = None,
              reset_strategy: Union[UserDataLimitResetStrategy, list] = None,
              return_with_count: bool = False) -> Union[List[User], Tuple[List[User], int]]:
    query = db.query(User)
    if username:
        query = query.filter(User.username.ilike(f'%{username}%'))
    if status:
        if isinstance(status, list):
            query = query.filter(User.status.in_(status))
        else:
            query = query.filter(User.status == status)
    if reset_strategy:
        if isinstance(reset_strategy, list):
            query = query.filter(User.data_limit_reset_strategy.in_(reset_strategy))
        else:
            query = query.filter(User.data_limit_reset_strategy == reset_strategy)
    if admin:
        query = query.filter(User.admin == admin)
    if offset:
        query = query.offset(offset)
    if limit:
        query = query.limit(limit)
    if sort:
        query = query.order_by(*(opt.value for opt in sort))

    if return_with_count is True:
        return query.all(), query.count()

    return query.all()


def get_users_count(db: Session, status: UserStatus = None, admin: Admin = None):
    query = db.query(User.id)
    if admin:
        query = query.filter(User.admin == admin)
    if status:
        query = query.filter(User.status == status)
    return query.count()


def create_user(db: Session, user: UserCreate, admin: Admin = None):
    excluded_inbounds_tags = user.excluded_inbounds
    proxies = []
    for proxy_type, settings in user.proxies.items():
        excluded_inbounds = [
            get_or_create_inbound(db, tag) for tag in excluded_inbounds_tags[proxy_type]
        ]
        proxies.append(
            Proxy(type=proxy_type.value,
                  settings=settings.dict(no_obj=True),
                  excluded_inbounds=excluded_inbounds)
        )

    dbuser = User(
        username=user.username,
        proxies=proxies,
        data_limit=(user.data_limit or None),
        expire=(user.expire or None),
        admin=admin,
        data_limit_reset_strategy=user.data_limit_reset_strategy
    )
    db.add(dbuser)
    db.commit()
    db.refresh(dbuser)
    return dbuser


def remove_user(db: Session, dbuser: User):
    db.delete(dbuser)
    db.commit()
    return dbuser


def update_user(db: Session, dbuser: User, modify: UserModify):
    if modify.proxies:
        for proxy_type, settings in modify.proxies.items():
            dbproxy = db.query(Proxy) \
                .where(Proxy.user == dbuser, Proxy.type == proxy_type) \
                .first()
            if dbproxy:
                dbproxy.settings = settings.dict(no_obj=True)
            else:
                dbuser.proxies.append(Proxy(type=proxy_type, settings=settings.dict(no_obj=True)))
        for proxy in dbuser.proxies:
            if proxy.type not in modify.proxies:
                db.delete(proxy)

    if modify.inbounds:
        for proxy_type, tags in modify.excluded_inbounds.items():
            dbproxy = db.query(Proxy) \
                .where(Proxy.user == dbuser, Proxy.type == proxy_type) \
                .first()
            if dbproxy:
                dbproxy.excluded_inbounds = [get_or_create_inbound(db, tag) for tag in tags]

    if modify.data_limit is not None:
        dbuser.data_limit = (modify.data_limit or None)

    if modify.expire is not None:
        dbuser.expire = (modify.expire or None)

    if modify.data_limit_reset_strategy is not None:
        dbuser.data_limit_reset_strategy = modify.data_limit_reset_strategy.value

    db.commit()
    db.refresh(dbuser)
    return dbuser


def reset_user_data_usage(db: Session, dbuser: User):
    usage_log = UserUsageResetLogs(
        user=dbuser,
        used_traffic_at_reset=dbuser.used_traffic,
    )
    db.add(usage_log)

    dbuser.used_traffic = 0
    dbuser.status = UserStatus.active.value
    db.add(dbuser)

    db.commit()
    return dbuser


def update_user_status(db: Session, dbuser: User, status: UserStatus):
    dbuser.status = status
    db.commit()
    db.refresh(dbuser)
    return dbuser


def get_system_usage(db: Session):
    return db.query(System).first()


def get_jwt_secret_key(db: Session):
    return db.query(JWT).first().secret_key


def get_admin(db: Session, username: str):
    return db.query(Admin).filter(Admin.username == username).first()


def create_admin(db: Session, admin: AdminCreate):
    dbadmin = Admin(
        username=admin.username,
        hashed_password=admin.hashed_password
    )
    db.add(dbadmin)
    db.commit()
    db.refresh(dbadmin)
    return dbadmin


def update_admin(db: Session, dbadmin: Admin, modified_admin: AdminModify):
    dbadmin.hashed_password = modified_admin.hashed_password
    db.commit()
    db.refresh(dbadmin)
    return dbadmin


def remove_admin(db: Session, dbadmin: Admin):
    db.delete(dbadmin)
    db.commit()
    return dbadmin


def get_admins(db: Session,
               offset: int = None,
               limit: int = None,
               username: str = None):
    query = db.query(Admin)
    if username:
        query = query.filter(User.username.ilike(f'%{username}%'))
    if offset:
        query = query.offset(offset)
    if limit:
        query = query.limit(limit)
    return query.all()

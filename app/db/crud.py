import re
from datetime import datetime
from enum import Enum
from typing import Dict, List, Optional, Tuple, Union

from uuid import uuid4

from sqlalchemy.orm import Session
from sqlalchemy import and_, or_

from app import xray

from app.db.models import (JWT, Admin, Node, Proxy, ProxyHost, ProxyInbound,
                           ProxyTypes, System, User, UserTemplate, 
                           UserUsageResetLogs, NodeUserUsage, NodeUsage,
                           ClashRule, ClashRuleset, ClashProxyGroup, ClashProxy,
                           ClashSetting)
from app.models.admin import AdminCreate, AdminModify, AdminPartialModify
from app.models.node import NodeCreate, NodeModify, NodeStatus, NodeUsageResponse
from app.models.clash import (ClashRuleCreate, ClashRulesetCreate, ClashProxyGroupCreate,
                              ClashProxyCreate, ClashSettingCreate)
from app.models.proxy import ProxyHost as ProxyHostModify
from app.models.user import (UserCreate, UserDataLimitResetStrategy,
                             UserModify, UserStatus, UserUsageResponse)
from app.models.user_template import UserTemplateCreate, UserTemplateModify
from app.utils.share import SERVER_IP

def add_default_host(db: Session, inbound: ProxyInbound):
    host = ProxyHost(remark="🚀 Marz ({USERNAME}) [{PROTOCOL} - {TRANSPORT}]", address="{SERVER_IP}", inbound=inbound)
    db.add(host)
    db.commit()

def get_or_create_inbound(db: Session, inbound_tag: str):
    inbound = db.query(ProxyInbound).filter(ProxyInbound.tag == inbound_tag).first()
    if not inbound:
        inbound = ProxyInbound(tag=inbound_tag)
        db.add(inbound)
        db.commit()
        add_default_host(db, inbound)
        db.refresh(inbound)

    return inbound


def get_hosts(db: Session, inbound_tag: str):
    inbound = get_or_create_inbound(db, inbound_tag)
    return inbound.hosts


def add_host(db: Session, inbound_tag: str, host: ProxyHostModify):
    inbound = get_or_create_inbound(db, inbound_tag)
    inbound.hosts.append(
        ProxyHost(
            remark=host.remark,
            address=host.address,
            port=host.port,
            sni=host.sni,
            host=host.host,
            inbound=inbound,
            security=host.security,
            alpn=host.alpn,
            fingerprint=host.fingerprint
        )
    )
    db.commit()
    db.refresh(inbound)
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
            inbound=inbound,
            security=host.security,
            alpn=host.alpn,
            fingerprint=host.fingerprint
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
              offset: Optional[int] = None,
              limit: Optional[int] = None,
              username: Optional[str] = None,
              status: Optional[Union[UserStatus, list]] = None,
              sort: Optional[List[UsersSortingOptions]] = None,
              admin: Optional[Admin] = None,
              reset_strategy: Optional[Union[UserDataLimitResetStrategy, list]] = None,
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

    # count it before applying limit and offset
    if return_with_count:
        count = query.count()

    if sort:
        query = query.order_by(*(opt.value for opt in sort))

    if offset:
        query = query.offset(offset)
    if limit:
        query = query.limit(limit)

    if return_with_count:
        return query.all(), count

    return query.all()


def get_user_usages(db: Session, dbuser: User, start: datetime, end: datetime) -> List[UserUsageResponse]:
    usages = {}

    usages[0] = UserUsageResponse(  # Main Core
        node_id=None,
        node_name="Master",
        used_traffic=0
    )
    for node in db.query(Node).all():
        usages[node.id] = UserUsageResponse(
            node_id=node.id,
            node_name=node.name,
            used_traffic=0
        )

    cond = and_(NodeUserUsage.user_id == dbuser.id,
                NodeUserUsage.created_at >= start,
                NodeUserUsage.created_at <= end)

    for v in db.query(NodeUserUsage).filter(cond):
        try:
            usages[v.node_id or 0].used_traffic += v.used_traffic
        except KeyError:
            pass

    return list(usages.values())


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
    added_proxies: Dict[ProxyTypes, Proxy] = {}
    if modify.proxies:
        for proxy_type, settings in modify.proxies.items():
            dbproxy = db.query(Proxy) \
                .where(Proxy.user == dbuser, Proxy.type == proxy_type) \
                .first()
            if dbproxy:
                dbproxy.settings = settings.dict(no_obj=True)
            else:
                new_proxy = Proxy(type=proxy_type, settings=settings.dict(no_obj=True))
                dbuser.proxies.append(new_proxy)
                added_proxies.update({proxy_type: new_proxy})
        for proxy in dbuser.proxies:
            if proxy.type not in modify.proxies:
                db.delete(proxy)
    if modify.inbounds:
        for proxy_type, tags in modify.excluded_inbounds.items():
            dbproxy = db.query(Proxy) \
                .where(Proxy.user == dbuser, Proxy.type == proxy_type) \
                .first() or added_proxies.get(proxy_type)
            if dbproxy:
                dbproxy.excluded_inbounds = [get_or_create_inbound(db, tag) for tag in tags]

    if modify.status is not None:
        dbuser.status = modify.status

    if modify.data_limit is not None:
        dbuser.data_limit = (modify.data_limit or None)
        if dbuser.status not in (UserStatus.expired, UserStatus.disabled):
            if not dbuser.data_limit or dbuser.used_traffic < dbuser.data_limit:
                dbuser.status = UserStatus.active
            else:
                dbuser.status = UserStatus.limited

    if modify.expire is not None:
        dbuser.expire = (modify.expire or None)
        if dbuser.status not in (UserStatus.limited, UserStatus.disabled):
            if not dbuser.expire or dbuser.expire > datetime.utcnow().timestamp():
                dbuser.status = UserStatus.active
            else:
                dbuser.status = UserStatus.expired

    if modify.data_limit_reset_strategy is not None:
        dbuser.data_limit_reset_strategy = modify.data_limit_reset_strategy.value

    if modify.sub_url_prefix is not None:
        dbuser.sub_url_prefix = re.sub(r"/+$", "", modify.sub_url_prefix)

    if modify.sub_tags is not None:
        dbuser.sub_tags = modify.sub_tags

    if modify.sub_revoked_at is None:
        dbuser.sub_revoked_at = datetime.utcnow()

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
    dbuser.node_usages.clear()
    if dbuser.status not in (UserStatus.expired or UserStatus.disabled):
        dbuser.status = UserStatus.active.value
    db.add(dbuser)

    db.commit()
    db.refresh(dbuser)
    return dbuser


def revoke_user_sub(db: Session, dbuser: User):
    dbuser.sub_revoked_at = datetime.utcnow()
    db.commit()
    db.refresh(dbuser)
    return dbuser


def reset_all_users_data_usage(db: Session, admin: Optional[Admin] = None):
    query = db.query(User)

    if admin:
        query = query.filter(User.admin == admin)

    for dbuser in query.all():
        dbuser.used_traffic = 0
        if dbuser.status not in (UserStatus.expired or UserStatus.disabled):
            dbuser.status = UserStatus.active
        dbuser.usage_logs.clear()
        dbuser.node_usages.clear()
        db.add(dbuser)

    db.commit()


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
        hashed_password=admin.hashed_password,
        is_sudo=admin.is_sudo
    )
    db.add(dbadmin)
    db.commit()
    db.refresh(dbadmin)
    return dbadmin


def update_admin(db: Session, dbadmin: Admin, modified_admin: AdminModify):
    dbadmin.is_sudo = modified_admin.is_sudo
    dbadmin.hashed_password = modified_admin.hashed_password
    db.commit()
    db.refresh(dbadmin)
    return dbadmin


def partial_update_admin(db: Session, dbadmin: Admin, modified_admin: AdminPartialModify):
    if modified_admin.is_sudo is not None:
        dbadmin.is_sudo = modified_admin.is_sudo
    if modified_admin.password is not None:
        dbadmin.hashed_password = modified_admin.hashed_password

    db.commit()
    db.refresh(dbadmin)
    return dbadmin


def remove_admin(db: Session, dbadmin: Admin):
    db.delete(dbadmin)
    db.commit()
    return dbadmin


def get_admins(db: Session,
               offset: Optional[int] = None,
               limit: Optional[int] = None,
               username: Optional[str] = None):
    query = db.query(Admin)
    if username:
        query = query.filter(Admin.username.ilike(f'%{username}%'))
    if offset:
        query = query.offset(offset)
    if limit:
        query = query.limit(limit)
    return query.all()


def create_user_template(db: Session, user_template: UserTemplateCreate) -> UserTemplate:
    inbound_tags: List[str] = []
    for _, i in user_template.inbounds.items():
        inbound_tags.extend(i)
    dbuser_template = UserTemplate(
        name=user_template.name,
        data_limit=user_template.data_limit,
        expire_duration=user_template.expire_duration,
        username_prefix=user_template.username_prefix,
        username_suffix=user_template.username_suffix,
        inbounds=db.query(ProxyInbound).filter(ProxyInbound.tag.in_(inbound_tags)).all()
    )
    db.add(dbuser_template)
    db.commit()
    db.refresh(dbuser_template)
    return dbuser_template


def update_user_template(
        db: Session, dbuser_template: UserTemplate, modified_user_template: UserTemplateModify) -> UserTemplate:
    if modified_user_template.name is not None:
        dbuser_template.name = modified_user_template.name
    if modified_user_template.data_limit is not None:
        dbuser_template.data_limit = modified_user_template.data_limit
    if modified_user_template.expire_duration is not None:
        dbuser_template.expire_duration = modified_user_template.expire_duration
    if modified_user_template.username_prefix is not None:
        dbuser_template.username_prefix = modified_user_template.username_prefix
    if modified_user_template.username_suffix is not None:
        dbuser_template.username_suffix = modified_user_template.username_suffix

    if modified_user_template.inbounds:
        inbound_tags: List[str] = []
        for _, i in modified_user_template.inbounds.items():
            inbound_tags.extend(i)
        dbuser_template.inbounds = db.query(ProxyInbound).filter(ProxyInbound.tag.in_(inbound_tags)).all()

    db.commit()
    db.refresh(dbuser_template)
    return dbuser_template


def remove_user_template(db: Session, dbuser_template: UserTemplate):
    db.delete(dbuser_template)
    db.commit()


def get_user_template(db: Session, user_template_id: int) -> UserTemplate:
    return db.query(UserTemplate).filter(UserTemplate.id == user_template_id).first()


def get_user_templates(
        db: Session, offset: Union[int, None] = None, limit: Union[int, None] = None) -> List[UserTemplate]:
    dbuser_templates = db.query(UserTemplate)
    if offset:
        dbuser_templates = dbuser_templates.offset(offset)
    if limit:
        dbuser_templates = dbuser_templates.limit(limit)

    return dbuser_templates.all()


def get_node(db: Session, name: str):
    return db.query(Node).filter(Node.name == name).first()


def get_node_by_id(db: Session, node_id: int):
    return db.query(Node).filter(Node.id == node_id).first()


def get_nodes(db: Session, status: Optional[Union[NodeStatus, list]] = None):
    query = db.query(Node)

    if status:
        if isinstance(status, list):
            query = query.filter(Node.status.in_(status))
        else:
            query = query.filter(Node.status == status)

    return query.all()


def get_nodes_usage(db: Session, start: datetime, end: datetime) -> List[NodeUsageResponse]:
    usages = {}

    usages[0] = NodeUsageResponse(  # Main Core
        node_id=None,
        node_name="Master",
        uplink=0,
        downlink=0
    )
    for node in db.query(Node).all():
        usages[node.id] = NodeUsageResponse(
            node_id=node.id,
            node_name=node.name,
            uplink=0,
            downlink=0
        )

    cond = and_(NodeUsage.created_at >= start, NodeUsage.created_at <= end)

    for v in db.query(NodeUsage).filter(cond):
        try:
            usages[v.node_id or 0].uplink += v.uplink
            usages[v.node_id or 0].downlink += v.downlink
        except KeyError:
            pass

    return list(usages.values())


def create_node(db: Session, node: NodeCreate):
    dbnode = Node(name=node.name,
                  address=node.address,
                  port=node.port,
                  api_port=node.api_port,
                  certificate=node.certificate)

    db.add(dbnode)
    db.commit()
    db.refresh(dbnode)
    return dbnode


def remove_node(db: Session, dbnode: Node):
    db.delete(dbnode)
    db.commit()
    return dbnode


def update_node(db: Session, dbnode: Node, modify: NodeModify):
    if modify.name is not None:
        dbnode.name = modify.name

    if modify.address is not None:
        dbnode.address = modify.address

    if modify.port is not None:
        dbnode.port = modify.port

    if modify.api_port is not None:
        dbnode.api_port = modify.api_port

    if modify.certificate is not None:
        dbnode.certificate = modify.certificate

    db.commit()
    db.refresh(dbnode)
    return dbnode


def update_node_status(db: Session, dbnode: Node, status: NodeStatus, message: str = None, version: str = None):
    dbnode.status = status
    dbnode.message = message
    dbnode.xray_version = version
    dbnode.last_status_change = datetime.utcnow()
    db.commit()
    db.refresh(dbnode)
    return dbnode

def update_user_tag(db: Session, old_tag: str, new_tag: str):
    if not old_tag or old_tag == new_tag:
        return
    
    found = db.query(ClashProxy.id).filter(ClashProxy.tag == old_tag).first() or \
        db.query(ClashProxyGroup.id).filter(ClashProxyGroup.tag == old_tag).first()
    
    query = db.query(User).filter(User.sub_tags.ilike(f'%{old_tag}%'))
    for dbuser in query.all():
        tags = str(dbuser.sub_tags).split(",")
        try:
            idx = tags.index(old_tag)
            if new_tag and not new_tag in tags:
                tags.insert(idx + 1, new_tag)
            if not found:
                tags.remove(old_tag)
            dbuser.sub_tags = ",".join(tags)
        except Exception:
            pass

    db.commit()

def create_clash_rule(db: Session, rule: ClashRuleCreate):
    dbrule = ClashRule(
        type=rule.type,
        content=rule.content,
        option=rule.option,
        policy=rule.policy,
        priority=rule.priority,
        ruleset_id=rule.ruleset_id,
        modified_at=datetime.utcnow()
    )
    db.add(dbrule)
    db.commit()
    db.refresh(dbrule)
    return dbrule

def get_clash_rule(db: Session, id: int):
    return db.query(ClashRule).filter(ClashRule.id == id).first()

def update_clash_rule(db: Session, dbrule: ClashRule, modify: ClashRuleCreate):
    dbrule.content = modify.content
    dbrule.option = modify.option
    dbrule.policy = modify.policy
    dbrule.priority = modify.priority
    dbrule.type = modify.type
    dbrule.ruleset_id = modify.ruleset_id
    dbrule.modified_at = datetime.utcnow()
    db.commit()
    db.refresh(dbrule)
    return dbrule

def remove_clash_rule(db: Session, dbrule: ClashRule):
    db.delete(dbrule)
    db.commit()
    return dbrule

def create_clash_ruleset(db: Session, ruleset: ClashRulesetCreate):
    dbruleset = ClashRuleset(
        name=ruleset.name,
        builtin=False,
        policy=ruleset.policy,
        settings=ruleset.settings,
        modified_at=datetime.utcnow()
    )
    db.add(dbruleset)
    db.commit()
    db.refresh(dbruleset)
    return dbruleset

def get_clash_ruleset(db: Session, name: Optional[str] = None, id: Optional[int] = None) -> ClashRuleset:
    if name is not None:
        return db.query(ClashRuleset).filter(ClashRuleset.name == name).first()
    else:
        return db.query(ClashRuleset).filter(ClashRuleset.id == id).first()

def update_clash_ruleset(db: Session, dbruleset: ClashRuleset, modify: ClashRulesetCreate):
    dbruleset.name = modify.name
    dbruleset.settings = modify.settings
    dbruleset.policy = modify.policy
    dbruleset.modified_at = datetime.utcnow()
    db.commit()
    db.refresh(dbruleset)
    return dbruleset

def remove_clash_ruleset(db: Session, dbruleset: ClashRuleset):
    if dbruleset.builtin:
        dbruleset.rules.clear()
    else:
        db.delete(dbruleset)

    db.commit()
    return dbruleset

ClashRuleSortingOptions = Enum('ClashRuleSortingOptions', {
    'modified_at': ClashRule.modified_at.asc(),
    'type': ClashRule.type.asc(),
    'content': ClashRule.content.asc(),
    'option': ClashRule.option.asc(),
    '-modified_at': ClashRule.modified_at.desc(),
    '-type': ClashRule.type.desc(),
    '-content': ClashRule.content.desc(),
    '-option': ClashRule.option.desc(),
})

def get_clash_rules(db: Session,
              offset: Optional[int] = None,
              limit: Optional[int] = None,
              search: Optional[str] = None,
              ruleset: Optional[str] = None,
              sort: Optional[List[ClashRuleSortingOptions]] = None
            ) -> Tuple[List[ClashRule], int]:
    query = db.query(ClashRule)

    if search:
        query = query.filter(ClashRule.content.ilike(f'%{search}%'))

    if ruleset:
        v = db.query(ClashRuleset).filter(ClashRuleset.name == ruleset).first()
        if v is None:
            return [], 0
        else:
            query = query.filter(ClashRule.ruleset_id == v.id)

    count = query.count()

    if sort:
        query = query.order_by(*(opt.value for opt in sort))

    if offset:
        query = query.offset(offset)
        
    if limit:
        query = query.limit(limit)

    return query.all(), count

def get_clash_rulesets(db: Session) -> List[ClashRuleset]:
    query = db.query(ClashRuleset)

    query = query.order_by(ClashRuleset.name)

    return query.all()

ClashProxySortingOptions = Enum('ClashProxySortingOptions', {
    'id': ClashProxy.id.asc(),
    'modified_at': ClashProxy.modified_at.asc(),
    'inbound': ClashProxy.inbound.asc(),
    'name': ClashProxy.name.asc(),
    'server': ClashProxy.server.asc(),
    'tag': ClashProxy.tag.asc(),
    '-id': ClashProxy.id.desc(),
    '-modified_at': ClashProxy.modified_at.desc(),
    '-inbound': ClashProxy.inbound.desc(),
    '-name': ClashProxy.name.desc(),
    '-server': ClashProxy.server.desc(),
    '-tag': ClashProxy.tag.desc(),
})

def get_clash_proxies(db: Session,
              offset: Optional[int] = None,
              limit: Optional[int] = None,
              search: Optional[str] = None,
              sort: Optional[List[ClashProxySortingOptions]] = None
            ) -> Tuple[List[ClashProxy], int]:
    query = db.query(ClashProxy)

    if search:
        query = query.filter(or_(ClashProxy.name.ilike(f'%{search}%'),
                                 ClashProxy.server.ilike(f'%{search}%'),
                                 ClashProxy.inbound.ilike(f'%{search}%'),
                                 ClashProxy.tag.ilike(f'%{search}%')))

    count = query.count()

    if sort:
        query = query.order_by(*(opt.value for opt in sort))

    if offset:
        query = query.offset(offset)
        
    if limit:
        query = query.limit(limit)

    return query.all(), count

def get_clash_proxy(db: Session, id: int) -> ClashProxy:
    return db.query(ClashProxy).filter(ClashProxy.id == id).first()

def get_clash_proxy_setting(protocol):
    settings = {
        "trojan": {"security": "tls", "fingerprint": "chrome", "udp": True, "allow_insecure": False},
        "vless": {"security": "tls", "fingerprint": "chrome", "udp": True, "allow_insecure": False},
        "vmess": {"fingerprint": "chrome", "udp": True, "allow_insecure": False},
        "shadowsocks": {"udp": True},
    }
    return settings.get(protocol, {})

def init_builtin_proxy(db: Session, inbound_tag: str):
    dbproxy = db.query(ClashProxy).filter(ClashProxy.inbound == inbound_tag, ClashProxy.builtin == 1).first()
    if not dbproxy:
        inbound = xray.config.inbounds_by_tag.get(inbound_tag)
        protocol = inbound["protocol"]
        dbproxy = ClashProxy(
            name=inbound_tag,
            inbound=inbound_tag,
            builtin=True,
            server=SERVER_IP,
            tag="built-in",
            port=inbound["port"],
            settings={protocol: get_clash_proxy_setting(protocol)},
            modified_at=datetime.utcnow()
        )
        db.add(dbproxy)
        db.commit()

def create_clash_proxy(db: Session, proxy: ClashProxyCreate):
    dbproxy = ClashProxy(
        name=proxy.name,
        inbound=proxy.inbound,
        server=proxy.server,
        tag=proxy.tag,
        port=proxy.port,
        settings=proxy.settings,
        modified_at=datetime.utcnow()
    )
    db.add(dbproxy)
    db.commit()
    db.refresh(dbproxy)
    return dbproxy

def update_clash_proxy(db: Session, dbproxy: ClashProxy, modify: ClashProxyCreate):
    old_tag = dbproxy.tag
    new_tag = old_tag

    dbproxy.name = modify.name
    dbproxy.port = modify.port
    dbproxy.server = modify.server
    dbproxy.settings = modify.settings
    dbproxy.modified_at = datetime.utcnow()

    if not dbproxy.builtin:
        new_tag = modify.tag
        dbproxy.tag = modify.tag
        dbproxy.inbound = modify.inbound
    
    db.commit()
    db.refresh(dbproxy)

    update_user_tag(db, old_tag, new_tag)

    return dbproxy

def remove_clash_proxy(db: Session, dbproxy: ClashProxy):
    old_tag = dbproxy.tag
    new_tag = ""

    db.delete(dbproxy)
    db.commit()

    update_user_tag(db, old_tag, new_tag)

    return dbproxy

def reset_clash_proxy(db: Session, dbproxy: ClashProxy):
    inbound = xray.config.inbounds_by_tag.get(dbproxy.inbound)
    protocol = inbound["protocol"]
    dbproxy.name=dbproxy.inbound
    dbproxy.server=SERVER_IP
    dbproxy.port=inbound["port"]
    dbproxy.settings={protocol: get_clash_proxy_setting(protocol)}
    dbproxy.modified_at=datetime.utcnow()
    db.commit()
    db.refresh(dbproxy)
    return dbproxy

ClashProxyGroupSortingOptions = Enum('ClashProxyGroupSortingOptions', {
    'id': ClashProxyGroup.id.asc(),
    'modified_at': ClashProxyGroup.modified_at.asc(),
    'type': ClashProxyGroup.type.asc(),
    'name': ClashProxyGroup.name.asc(),
    'tag': ClashProxyGroup.tag.asc(),
    '-id': ClashProxyGroup.id.desc(),
    '-modified_at': ClashProxyGroup.modified_at.desc(),
    '-type': ClashProxyGroup.type.desc(),
    '-name': ClashProxyGroup.name.desc(),
    '-tag': ClashProxyGroup.tag.desc(),
})

def get_clash_proxy_group(db: Session, id: int) -> ClashProxyGroup:
    return db.query(ClashProxyGroup).filter(ClashProxyGroup.id == id).first()

def create_clash_proxy_group(db: Session, proxy_group: ClashProxyGroupCreate):
    dbproxy_group = ClashProxyGroup(
        name=proxy_group.name,
        type=proxy_group.type,
        tag=proxy_group.tag,
        proxies=proxy_group.proxies,
        settings=proxy_group.settings,
        builtin=False,
        modified_at=datetime.utcnow()
    )
    db.add(dbproxy_group)
    db.commit()
    db.refresh(dbproxy_group)
    return dbproxy_group

def update_clash_proxy_group(db: Session, dbproxy_group: ClashProxyGroup, modify: ClashProxyGroupCreate):
    old_tag = dbproxy_group.tag
    new_tag = old_tag

    dbproxy_group.name = modify.name
    dbproxy_group.settings = modify.settings
    dbproxy_group.modified_at = datetime.utcnow()
    if not dbproxy_group.builtin:
        new_tag = modify.tag
        dbproxy_group.tag = modify.tag
        dbproxy_group.type = modify.type
        dbproxy_group.proxies = modify.proxies
        dbproxy_group.settings = modify.settings

    db.commit()
    db.refresh(dbproxy_group)

    update_user_tag(db, old_tag, new_tag)

    return dbproxy_group

def remove_clash_proxy_group(db: Session, dbproxy_group: ClashProxyGroup):
    old_tag = dbproxy_group.tag
    new_tag = ""

    db.delete(dbproxy_group)
    db.commit()

    update_user_tag(db, old_tag, new_tag)

    return dbproxy_group

def get_clash_proxy_groups(db: Session,
              offset: Optional[int] = None,
              limit: Optional[int] = None,
              search: Optional[str] = None,
              sort: Optional[List[ClashProxyGroupSortingOptions]] = None,
              builtin: Optional[bool] = None,
            ) -> Tuple[List[ClashProxyGroup], int]:
    query = db.query(ClashProxyGroup)

    if search:
        query = query.filter(or_(ClashProxyGroup.name.ilike(f'%{search}%'),
                                 ClashProxyGroup.tag.ilike(f'%{search}%')))
        
    if builtin:
        query = query.filter(ClashProxyGroup.builtin == builtin)

    count = query.count()

    if sort:
        query = query.order_by(*(opt.value for opt in sort))

    if offset:
        query = query.offset(offset)
        
    if limit:
        query = query.limit(limit)

    return query.all(), count

def get_all_clash_proxy_briefs(db:Session):
    return db.query(ClashProxy.id, ClashProxy.name, ClashProxy.server, ClashProxy.builtin, ClashProxy.tag).all()

def get_all_clash_proxy_group_briefs(db:Session):
    return db.query(ClashProxyGroup.id, ClashProxyGroup.name, 
                    ClashProxyGroup.tag, ClashProxyGroup.builtin).all()

def get_clash_settings(db: Session) -> Tuple[List[ClashSetting], int]:
    query = db.query(ClashSetting)
    return query.all(), query.count()

def get_clash_setting(db: Session, name: str) -> ClashSetting:
    return db.query(ClashSetting).filter(ClashSetting.name == name).first()

def update_clash_setting(db: Session, dbsetting: ClashSetting, modify: ClashSettingCreate):
    dbsetting.content = modify.content
    db.commit()
    db.refresh(dbsetting)
    return dbsetting
import re
import yaml
import secrets
import random
from typing import Literal, Dict, Optional
import sqlalchemy
from fastapi import Depends, Header, Response, HTTPException

from fastapi import Depends, Header, Response
from app import app, logger, xray
from app.db import Session, crud, get_db
from app.db.models import ClashUser

from app.models.proxy import ProxyTypes
from app.models.user import UserResponse, UserStatus
from app.models.admin import Admin
from app.models.clash import (ClashRulesResponse, ClashRuleResponse,
    ClashRulesetsResponse, ClashProxyGroupsResponse, ClashProxiesResponse,
    ClashUserResponse, ClashUsersResponse, ClashRuleCreate, ClashRulesetResponse,
    ClashRulesetCreate, ClashProxyGroupResponse, ClashProxyGroupCreate, 
    ClashProxyTagsResponse, ClashProxyBriefResponse, ClashUserCreate,
    ClashProxyResponse, ClashProxyCreate, ClashProxyInboundResponse, 
    ClashProxyInboundsResponse, ClashSettingResponse, ClashSettingCreate,
    ClashProxyTagResponse, ClashProxyBriefsResponse)

def value_error(err: str, message: str):
    return {"err": err, "message": message}

@app.put("/api/clash/user/{username}", tags=['Clash'], response_model=ClashUserResponse)
def modify_clash_user(username: str,
                modified: ClashUserCreate,
                db: Session = Depends(get_db),
                admin: Admin = Depends(Admin.get_current)):
    
    dbuser = crud.get_clash_user(db, username)
    if not dbuser:
        raise HTTPException(status_code=404, detail="User not found")
    
    dbuser = crud.update_clash_user(db, dbuser, modified)
    return ClashUserResponse(
        id=dbuser.id,
        username=username,
        tags=dbuser.tags,
        code=dbuser.code,
        domain=dbuser.domain
    )

@app.put("/api/clash/user/{username}/authcode/reset", tags=['Clash'], response_model=ClashUserResponse)
def reset_clash_user_authcode(username: str,
                db: Session = Depends(get_db),
                admin: Admin = Depends(Admin.get_current)):
    
    dbuser = crud.get_clash_user(db, username)
    if not dbuser:
        raise HTTPException(status_code=404, detail="User not found")
    
    dbuser = crud.reset_clash_user_authcode(db, dbuser)
    return ClashUserResponse(
        id=dbuser.id,
        username=username,
        tags=dbuser.tags,
        code=dbuser.code,
        domain=dbuser.domain
    )

@app.get("/api/clash/users", tags=['Clash'], response_model=ClashUsersResponse)
def get_clash_users(offset: int = None,
              limit: int = None,
              search: str = None,
              sort: str = None,
              db: Session = Depends(get_db),
              admin: Admin = Depends(Admin.get_current)):
    """
    Get all sub users
    """

    if sort is not None:
        opts = sort.strip(',').split(',')
        sort = []
        for opt in opts:
            try:
                sort.append(crud.ClashUserSortingOptions[opt])
            except KeyError:
                raise HTTPException(status_code=400,
                                    detail=f'"{opt}" is not a valid sort option')

    users, count = crud.get_clash_users(db=db, 
                                  offset=offset,
                                  limit=limit,
                                  search=search,
                                  sort=sort)
    data = []

    for v in users:
        data.append(ClashUserResponse(
            id=v.id,
            username=v.username,
            tags=v.tags if v.tags else "",
            code=v.code if v.code else "",
            domain=v.domain if v.domain else ""
        ))

    return {"data": data, "total": count}

@app.post("/api/clash/rule", tags=['Clash'], response_model=ClashRuleResponse)
def add_clash_rule(new_rule: ClashRuleCreate,
             db: Session = Depends(get_db),
             admin: Admin = Depends(Admin.get_current)):

    dbruleset = crud.get_clash_ruleset(db=db, name=new_rule.ruleset)
    if not dbruleset:
        raise HTTPException(status_code=404, detail="Ruleset not found")
    
    new_rule.ruleset_id = dbruleset.id

    try:
        dbrule = crud.create_clash_rule(db, new_rule)
    except sqlalchemy.exc.IntegrityError:
        raise HTTPException(status_code=409, detail=value_error("RuleExists", "Rule already exists"))

    logger.info(f"New rule \"{dbrule.content}\" added")
    return ClashRuleResponse(
        id=dbrule.id,
        type=dbrule.type,
        content=dbrule.content,
        option=dbrule.option,
        ruleset=new_rule.ruleset
    )

@app.put("/api/clash/rule/{id}", tags=['Clash'], response_model=ClashRuleResponse)
def modify_clash_rule(id: int,
                modified: ClashRuleCreate,
                db: Session = Depends(get_db),
                admin: Admin = Depends(Admin.get_current)):

    dbrule = crud.get_clash_rule(db, id)
    if not dbrule:
        raise HTTPException(status_code=404, detail="Rule not found")

    dbruleset = crud.get_clash_ruleset(db=db, name=modified.ruleset)
    if not dbruleset:
        raise HTTPException(status_code=404, detail="Ruleset not found")

    modified.ruleset_id = dbruleset.id
    crud.update_clash_rule(db, dbrule, modified)

    logger.info(f"Rule \"{dbrule.id}\" modified")

    return ClashRuleResponse(
        id=dbrule.id,
        type=dbrule.type,
        content=dbrule.content,
        option=dbrule.option,
        ruleset=modified.ruleset
    )

@app.delete("/api/clash/rule/{id}", tags=['Clash'])
def delete_clash_rule(id: int,
                db: Session = Depends(get_db),
                admin: Admin = Depends(Admin.get_current)):

    dbrule = crud.get_clash_rule(db, id)
    if not dbrule:
        raise HTTPException(status_code=404, detail="Rule not found")

    crud.remove_clash_rule(db, dbrule)

    logger.info(f"Rule \"{dbrule.id}\" deleted")

    return {}

@app.post("/api/clash/ruleset", tags=['Clash'], response_model=ClashRulesetResponse)
def add_clash_ruleset(new_ruleset: ClashRulesetCreate,
             db: Session = Depends(get_db),
             admin: Admin = Depends(Admin.get_current)):
    try:
        dbruleset = crud.create_clash_ruleset(db, new_ruleset)
    except sqlalchemy.exc.IntegrityError:
        raise HTTPException(status_code=409, detail=value_error("RulesetExists", "Ruleset already exists"))

    logger.info(f"New ruleset \"{dbruleset.name}\" added")
    return dbruleset

@app.put("/api/clash/ruleset/{id}", tags=['Clash'], response_model=ClashRulesetResponse)
def modify_clash_ruleset(id: int,
                modified: ClashRulesetCreate,
                db: Session = Depends(get_db),
                admin: Admin = Depends(Admin.get_current)):

    dbruleset = crud.get_clash_ruleset(db=db, id=id)
    if not dbruleset:
        raise HTTPException(status_code=404, detail="Ruleset not found")
    
    if dbruleset.builtin:
        modified.preferred_proxy = dbruleset.preferred_proxy
        modified.name = dbruleset.name

    crud.update_clash_ruleset(db, dbruleset, modified)

    logger.info(f"Ruleset \"{dbruleset.id}\" modified")

    return dbruleset

@app.delete("/api/clash/ruleset/{id}", tags=['Clash'])
def delete_clash_ruleset(id: int,
                db: Session = Depends(get_db),
                admin: Admin = Depends(Admin.get_current)):

    dbruleset = crud.get_clash_ruleset(db=db, id=id)
    if not dbruleset:
        raise HTTPException(status_code=404, detail="Ruleset not found")

    crud.remove_clash_ruleset(db, dbruleset)

    logger.info(f"Ruleset \"{dbruleset.id}\" deleted")

    return {}

@app.get("/api/clash/rules", tags=['Clash'], response_model=ClashRulesResponse)
def get_clash_rules(offset: int = None,
              limit: int = None,
              search: str = None,
              ruleset: str = None,
              sort: str = None,
              db: Session = Depends(get_db),
              admin: Admin = Depends(Admin.get_current)):
    """
    Get all rules
    """

    if sort is not None:
        opts = sort.strip(',').split(',')
        sort = []
        for opt in opts:
            try:
                sort.append(crud.ClashRuleSortingOptions[opt])
            except KeyError:
                raise HTTPException(status_code=400,
                                    detail=f'"{opt}" is not a valid sort option')

    rules, count = crud.get_clash_rules(db=db, 
                                  offset=offset,
                                  limit=limit,
                                  search=search,
                                  ruleset=ruleset,
                                  sort=sort)
    
    cache = {}
    data = []

    for v in rules:
        name = cache.get(v.ruleset_id)
        if name is None:
            rs = v.ruleset
            name = v.ruleset.name
            cache[v.ruleset_id] = name

        data.append(ClashRuleResponse(
            id=v.id,
            type=v.type,
            content=v.content,
            option=v.option if v.option is not None else "",
            ruleset=name
        ))

    return {"data": data, "total": count}


@app.get("/api/clash/rulesets", tags=['Clash'], response_model=ClashRulesetsResponse)
def get_clash_rulesets(db: Session = Depends(get_db),
              admin: Admin = Depends(Admin.get_current)):
    """
    Get all rulesets
    """

    rulesets = crud.get_clash_rulesets(db=db)
    data = []

    for v in rulesets:
        if v.name == "DIRECT":
            direct = v
        elif v.name == 'REJECT':
            reject = v
        elif v.name == "PROXY":
            proxy = v
        else:
            data.append(v)

    data.insert(0, direct)
    data.insert(1, proxy)
    data.insert(2, reject)

    return {"data": data}

@app.get("/api/clash/proxies", tags=['Clash'], response_model=ClashProxiesResponse)
def get_clash_proxies(offset: int = None,
              limit: int = None,
              search: str = None,
              sort: str = None,
              db: Session = Depends(get_db),
              admin: Admin = Depends(Admin.get_current)):
    """
    Get all proxies
    """

    if sort is not None:
        opts = sort.strip(',').split(',')
        sort = []
        for opt in opts:
            try:
                sort.append(crud.ClashProxySortingOptions[opt])
            except KeyError:
                raise HTTPException(status_code=400,
                                    detail=f'"{opt}" is not a valid sort option')

    data, count = crud.get_clash_proxies(db=db, 
                                  offset=offset,
                                  limit=limit,
                                  search=search,
                                  sort=sort)

    return {"data": data, "total": count}

@app.post("/api/clash/proxy", tags=['Clash'], response_model=ClashProxyResponse)
def add_clash_proxy(new_proxy: ClashProxyCreate,
             db: Session = Depends(get_db),
             admin: Admin = Depends(Admin.get_current)):
    try:
        dbproxy = crud.create_clash_proxy(db, new_proxy)
    except sqlalchemy.exc.IntegrityError:
        raise HTTPException(status_code=409, detail=value_error("ProxyExists", "Proxy already exists"))

    logger.info(f"New proxy \"{dbproxy.name}\" added")
    return dbproxy

@app.put("/api/clash/proxy/{id}", tags=['Clash'], response_model=ClashProxyResponse)
def modify_clash_proxy(id: int,
                modified: ClashProxyCreate,
                db: Session = Depends(get_db),
                admin: Admin = Depends(Admin.get_current)):

    dbproxy = crud.get_clash_proxy(db, id)
    if not dbproxy:
        raise HTTPException(status_code=404, detail="Proxy not found")
    
    if not dbproxy.builtin and modified.tag.lower() == "built-in":
        raise HTTPException(status_code=422, detail={
            "tag": value_error("BuiltinTagError", "Tag 'built-in' is not valid tag.")})

    crud.update_clash_proxy(db, dbproxy, modified)

    logger.info(f"Proxy \"{dbproxy.id}\" modified")

    return dbproxy

@app.delete("/api/clash/proxy/{id}", tags=['Clash'])
def delete_clash_proxy(id: int,
                db: Session = Depends(get_db),
                admin: Admin = Depends(Admin.get_current)):

    dbproxy = crud.get_clash_proxy(db, id)
    if not dbproxy:
        raise HTTPException(status_code=404, detail="Proxy not found")
    
    inbound = xray.config.inbounds_by_tag.get(dbproxy.inbound)
    if not inbound or not dbproxy.builtin:
        crud.remove_clash_proxy(db, dbproxy)
        logger.info(f"Proxy \"{dbproxy.id}\" deleted")
        return {}
    else:
        crud.reset_clash_proxy(db, dbproxy)
        logger.info(f"Proxy \"{dbproxy.id}\" reseted")
        return dbproxy

@app.post("/api/clash/proxy/group", tags=['Clash'], response_model=ClashProxyGroupResponse)
def add_clash_proxy_group(new_proxy_group: ClashProxyGroupCreate,
             db: Session = Depends(get_db),
             admin: Admin = Depends(Admin.get_current)):
    try:
        proxy_group = crud.create_clash_proxy_group(db, new_proxy_group)
    except sqlalchemy.exc.IntegrityError:
        raise HTTPException(status_code=409, detail=value_error("ProxyGroupExists", "Proxy group already exists"))

    logger.info(f"New proxy group \"{proxy_group.name}\" added")
    return proxy_group

@app.put("/api/clash/proxy/group/{id}", tags=['Clash'], response_model=ClashProxyGroupResponse)
def modify_clash_proxy_group(id: int,
                modified: ClashProxyGroupCreate,
                db: Session = Depends(get_db),
                admin: Admin = Depends(Admin.get_current)):

    dbproxy_group = crud.get_clash_proxy_group(db, id)
    if not dbproxy_group:
        raise HTTPException(status_code=404, detail="Proxy group not found")
    
    if not dbproxy_group.builtin and modified.tag.lower() == "built-in":
        raise HTTPException(status_code=422, detail={
            "tag": value_error("BuiltinTagError", "Tag 'built-in' is not valid tag.")})

    crud.update_clash_proxy_group(db, dbproxy_group, modified)

    logger.info(f"Proxy group \"{dbproxy_group.id}\" modified")

    return dbproxy_group

@app.delete("/api/clash/proxy/group/{id}", tags=['Clash'])
def delete_clash_proxy_group(id: int,
                db: Session = Depends(get_db),
                admin: Admin = Depends(Admin.get_current)):

    dbproxy_group = crud.get_clash_proxy_group(db, id)
    if not dbproxy_group:
        raise HTTPException(status_code=404, detail="Proxy group not found")
    
    if dbproxy_group.builtin:
        raise HTTPException(status_code=400, detail="Proxy group is builtin")

    crud.remove_clash_proxy_group(db, dbproxy_group)

    logger.info(f"Proxy group \"{dbproxy_group.id}\" deleted")

    return {}

@app.get("/api/clash/proxy/groups", tags=['Clash'], response_model=ClashProxyGroupsResponse)
def get_clash_proxy_groups(offset: int = None,
              limit: int = None,
              search: str = None,
              sort: str = None,
              db: Session = Depends(get_db),
              admin: Admin = Depends(Admin.get_current)):
    """
    Get all proxy groups
    """

    if sort is not None:
        opts = sort.strip(',').split(',')
        sort = []
        for opt in opts:
            try:
                sort.append(crud.ClashProxyGroupSortingOptions[opt])
            except KeyError:
                raise HTTPException(status_code=400,
                                    detail=f'"{opt}" is not a valid sort option')

    data, count = crud.get_clash_proxy_groups(db=db, 
                                  offset=offset,
                                  limit=limit,
                                  search=search,
                                  sort=sort)

    return {"data": data, "total": count}

@app.get("/api/clash/proxy/briefs", tags=['Clash'], response_model=ClashProxyBriefsResponse)
def get_clash_proxy_briefs(db: Session = Depends(get_db),
              admin: Admin = Depends(Admin.get_current)):
    briefs = []
    briefs.append(ClashProxyBriefResponse(
        id="DIRECT",
        name="DIRECT",
        tag="built-in",
        server="",
        builtin=True
    ))
    briefs.append(ClashProxyBriefResponse(
        id="REJECT",
        name="REJECT",
        tag="built-in",
        server="",
        builtin=True
    ))
    briefs.append(ClashProxyBriefResponse(
        id="...",
        name="...",
        tag="<User Tags>",
        server="",
        builtin=True
    ))
    for brief in crud.get_all_clash_proxy_briefs(db):
        briefs.append(ClashProxyBriefResponse(
            id=str(brief.id),
            name=brief.name,
            tag=brief.tag,
            server=brief.server,
            builtin=brief.builtin,
        ))
    for brief in crud.get_all_clash_proxy_group_briefs(db):
        briefs.append(ClashProxyBriefResponse(
            id=f"#{brief.id}",
            name=brief.name,
            tag=brief.tag,
            server="",
            builtin=brief.builtin
        ))
    
    briefs.sort(key=lambda v: v.name)

    return {"data": briefs}

@app.get("/api/clash/proxy/tags", tags=['Clash'], response_model=ClashProxyTagsResponse)
def get_clash_proxy_tags(db: Session = Depends(get_db),
              admin: Admin = Depends(Admin.get_current)):
    tags = []
    cache: Dict[str, ClashProxyTagResponse] = {}

    def add_tag(proxy, server):
        tag = str(proxy.tag) or ""
        tag_entry = cache.get(tag)
        if tag and not tag_entry:
            tag_entry = ClashProxyTagResponse(tag=tag, servers=[])
            cache[tag] = tag_entry
            tags.append(tag_entry)
        tag_entry.servers.append(f"{proxy.name} -> {server}")

    for proxy in crud.get_clash_proxies(db)[0]:
        add_tag(proxy, proxy.server)

    for proxy in crud.get_clash_proxy_groups(db)[0]:
        if not proxy.builtin:
            add_tag(proxy, "<Proxy Group>")
    
    tags.sort(key=lambda v: v.tag)

    return {"data": tags}
    
@app.get("/api/clash/proxy/inbounds", tags=['Clash'], response_model=ClashProxyInboundsResponse)
def get_clash_proxy_inbounds(db: Session = Depends(get_db),
              admin: Admin = Depends(Admin.get_current)):
    inbounds = []

    for ib in xray.config.inbounds:
        sni = ""
        ws_path = "/"
        if ib["tls"] == "reality":
            salt = secrets.token_hex(8)
            sni = random.choice(ib["sni"]).replace('*', salt)
        if ib["network"] == "ws":
            ws_path = ib["path"]

        inbounds.append(ClashProxyInboundResponse(
            name=ib["tag"],
            type=ib["protocol"],
            security=ib["tls"] if ib["tls"] else "none",
            network=ib["network"],
            servername=sni,
            ws_path=ws_path,
            port=ib["port"]
        ))
    
    inbounds.sort(key=lambda v: v.name)

    return {"data": inbounds}

@app.get("/api/clash/setting/{name}", tags=['Clash'], response_model=ClashSettingResponse)
def get_clash_setting(name: str,
             db: Session = Depends(get_db),
             admin: Admin = Depends(Admin.get_current)):

    dbsetting = crud.get_clash_setting(db=db, name=name)
    if not dbsetting:
        raise HTTPException(status_code=404, detail="Setting not found")
    
    return dbsetting

@app.put("/api/clash/setting/{name}", tags=['Clash'], response_model=ClashSettingResponse)
def modify_clash_setting(name: str,
                modified: ClashSettingCreate,
                db: Session = Depends(get_db),
                admin: Admin = Depends(Admin.get_current)):

    dbsetting = crud.get_clash_setting(db=db, name=name)
    if not dbsetting:
        raise HTTPException(status_code=404, detail="Setting not found")

    crud.update_clash_setting(db, dbsetting, modified)

    logger.info(f"Setting \"{dbsetting.name}\" modified")

    return modified

@app.get("/clash/sub/{authcode}/{username}", tags=['Clash'])
def user_subcription(authcode: str,
                     username: str,
                     db: Session = Depends(get_db),
                     user_agent: str = Header(default="")):

    def get_subscription_user_info(user: UserResponse) -> dict:
        return {
            "upload": 0,
            "download": user.used_traffic,
            "total": user.data_limit,
            "expire": user.expire,
        }

    dbuser = crud.get_clash_user(db, username)
    if not dbuser:
        return Response(status_code=404)
    
    user: UserResponse = UserResponse.from_orm(dbuser.user)

    if dbuser.code != authcode or not user.status == UserStatus.active:
        return Response(status_code=443)

    response_headers = {
        "content-disposition": f'attachment; filename="{username}"',
        "profile-update-interval": "6",
        "subscription-userinfo": "; ".join(
            f"{key}={val}"
            for key, val in get_subscription_user_info(user).items()
            if val is not None
        )
    }

    if re.match('^([Ss]hadowrocket|[Cc]lash-verge|[Cc]lash-?[Mm]eta)', user_agent):
        config_format = "clash-meta"
    elif re.match('^([Cc]lashX|[Cc]lash|[Ss]tash)', user_agent):
        config_format = "clash"
    else:
        config_format = "clash-meta" # TODO: v2ray or others

    logger.info(f"Generate subscription: user-agent={user_agent} config-format={config_format}")

    conf = generate_subscription_with_rules(db=db, dbuser=dbuser, config_format=config_format)

    if len(conf) == 0:
        return Response(status_code=204)
    else:
        return Response(content=conf, media_type="text/yaml", headers=response_headers)
    
def R(obj, field: str, default = None):
    try:
        for key in field.split('.'):
            obj = obj.get(key, default)
    except Exception:
        return default
    return obj if obj is not None else default

class ClashConfig:
    class BuiltinProxy:
        def __init__(self, name: str) -> None:
            self.name = name

    class Proxy(ClashProxyResponse):
        exported: Optional[bool] = False
        tag_index: Optional[int] = -1

        class Config:
            orm_mode = True

    class ProxyGroup(ClashProxyGroupResponse):
        exported: Optional[bool] = False
        tag_index: Optional[int] = -1

        class Config:
            orm_mode = True

    class Ruleset(ClashRulesetResponse):
        class Config:
            orm_mode = True
    
    class Rule(ClashRuleResponse):
        class Config:
            orm_mode = True

    def __init__(self, db: Session, dbuser: ClashUser, config_format: str) -> None:
        self.is_clash_meta = config_format == "clash-meta"

        # user setting
        self.user = UserResponse.from_orm(dbuser.user)
        self.active_inbounds = {ib: True for _, l in self.user.inbounds.items() for ib in l}

        # setting
        self.setting = crud.get_clash_setting(db, "clash")

        # proxies and proxy group
        self.proxies: list[ClashConfig.Proxy] = []
        self.proxies_by_id: Dict[int, ClashConfig.Proxy] = {}
        self.proxy_groups: list[ClashConfig.ProxyGroup] = []
        self.proxy_groups_by_id: Dict[int, ClashConfig.ProxyGroup] = {}
        tags = str(dbuser.tags).split(",") if dbuser.tags else []
        for obj in crud.get_clash_proxies(db=db)[0]:
            try:
                idx = tags.index(obj.tag)
            except Exception:
                idx = -1
            if idx >= 0 or (len(tags) == 0 and obj.builtin):
                proxy = ClashConfig.Proxy.from_orm(obj)
                proxy.exported = False
                proxy.tag_index = idx
                self.proxies_by_id[proxy.id] = proxy
                self.proxies.append(proxy)
        for obj in crud.get_clash_proxy_groups(db=db)[0]:
            try:
                idx = tags.index(obj.tag)
            except Exception:
                idx = -1
            if obj.builtin or idx >= 0:
                proxy_group = ClashConfig.ProxyGroup.from_orm(obj)
                proxy_group.exported = False
                proxy_group.tag_index = idx
                self.proxy_groups_by_id[proxy_group.id] = proxy_group
                self.proxy_groups.append(proxy_group)
        self.proxies.sort(key=lambda v: v.tag_index)
        self.proxy_groups.sort(key=lambda v: v.tag_index)
        self.builtin_proxy_groups = {
            "DIRECT": self.proxy_groups_by_id.get(1),
            "PROXY": self.proxy_groups_by_id.get(2),
            "MATCH": self.proxy_groups_by_id.get(3),
            "REJECT": self.proxy_groups_by_id.get(4),
        }
       
        # rules
        self.rulesets: list[ClashConfig.Ruleset] = []
        self.rules: list[ClashConfig.Rule] = []
        sorted1 = {
            "DOMAIN": 1, "DOMAIN-SUFFIX": 2, "DOMAIN-KEYWORD": 3,
            "SRC-IP-CIDR": 4, "SRC-PORT": 5, "DST-PORT": 6,
            "PROCESS-NAME": 7, "PROCESS-PATH": 8,
            # no-reslove
            "GEOIP": 9, "IP-CIDR": 9, "IP-CIDR6": 9, "SCRIPT": 9
        }
        sorted2 = {"GEOIP": 1}
        for ruleset in crud.get_clash_rulesets(db):
            self.rulesets.append(ClashConfig.Ruleset.from_orm(ruleset))
            for obj in ruleset.rules:
                self.rules.append(ClashConfig.Rule(
                    id=obj.id,
                    type=obj.type,
                    content=obj.content,
                    ruleset=ruleset.name,
                    option=obj.option
                ))
        self.rules.sort(key=lambda r:(sorted1[r.type], -len(r.option), sorted2.get(r.type, 0)))

        # init
        self.config = yaml.safe_load(self.setting.content)
        self.config["proxies"] = []
        self.config["proxy-groups"] = []
        self.config["rules"] = []

    def to_yaml(self):
        class Dumper(yaml.Dumper):
            def increase_indent(self, flow=False, *args, **kwargs):
                return super().increase_indent(flow=flow, indentless=False)
            
            def represent_sequence(self, tag, sequence, flow_style=None):
                node = super().represent_sequence(tag, sequence, flow_style)
                nones = []
                for v in node.value:
                    try:
                        if str(v.tag).endswith(":null") or len(v.value) == 0:
                            nones.append(v)
                    except Exception:
                        pass
                for v in nones:
                    node.value.remove(v)
                return node

            def represent_mapping(self, tag, mapping, flow_style=None):
                node = super().represent_mapping(tag, mapping, flow_style)
                nones = []
                for v in node.value:
                    try:
                        if str(v[1].tag).endswith(":null") or len(v[1].value) == 0:
                            nones.append(v)
                    except Exception:
                        pass
                for v in nones:
                    node.value.remove(v)
                return node 
        
        return yaml.dump(self.config, sort_keys=False, allow_unicode=True, Dumper=Dumper)
    
    def add_network_opts(self, node:dict, inbound: dict, settings: dict):
        salt = secrets.token_hex(8)
        security = R(inbound, "tls", "none")
        network = R(inbound, "network")
        if network == "ws":
            username = self.user.username
            path = R(inbound, "path") or "/"
            addition_path = R(settings, "ws_addition_path", "")
            port = inbound["port"]
            if addition_path:
                path = re.sub(r"//+", "/", f"{path}/{addition_path}?user={username}&port={port}")
            node["ws-opts"] = {
                "path": path,
                "headers": {
                    "Host": R(inbound, "host"),
                }
            }
        elif network == "grpc":                
            node["grpc-opts"] = {
                "grpc-service-name": R(inbound, "path"),
            }
        elif network == "http":
            node["network"] = "h2"
            node["h2-opts"] = {
                "path": R(inbound, "path"),
                "host": R(inbound, "host"),
            }
        elif network == "tcp" and R(inbound, "header_type") == "http":
            rawinbound = xray.config.get_inbound(inbound["tag"])
            request = R(rawinbound, "streamSettings.tcpSettings.header.request")
            node["network"] = "http"
            node["http-opts"] = {
                "method": R(request, "method"),
                "path": R(request, "path"),
                "headers": R(request, "headers")
            }
        if security == "reality":
            sni = random.choice(inbound["sni"]).replace('*', salt)
            node["servername"] = sni
            node["reality-opts"] = {
                "public-key": inbound["pbk"],
                "short-id": inbound["sid"],
            }
            if not node.get("client_fingerprint"):
                node["client_fingerprint"] = "chrome"

    def add_trojan(self, proxy: Proxy):
        inbound = xray.config.inbounds_by_tag.get(proxy.inbound)
        ibtype = R(inbound, "protocol")
        ibsecurity = R(inbound, "tls", "none")
        setting = self.user.proxies.get(ibtype).dict(no_obj=True)
        security = R(proxy.settings, "trojan.security", "none")

        # skip unsafe proxy
        if ibsecurity == "none" and security != "tls":
            return False

        node = {
            "name": proxy.name,
            "type": ibtype,
            "server": proxy.server,
            "port": int(proxy.port),
            "password": setting["password"],
            "sni": R(proxy.settings, "trojan.sni"),
            "tls": True,
            "udp": R(proxy.settings, "trojan.udp"),
            "alpn": R(proxy.settings, "trojan.alpn", "").split(","),
            "skip-cert-verify": R(proxy.settings, "trojan.allow_insecure"),
            "client_fingerprint": R(proxy.settings, "trojan.fingerprint"),
            "network": R(inbound, "network"),
        }
        self.add_network_opts(node, inbound, proxy.settings.get(ibtype, {}))
        self.config["proxies"].append(node)
        return True
    
    def add_vmess(self, proxy: Proxy):
        inbound = xray.config.inbounds_by_tag.get(proxy.inbound)
        ibtype = R(inbound, "protocol")
        ibsecurity = R(inbound, "tls", "none")
        setting = self.user.proxies.get(ibtype).dict(no_obj=True)
        security = R(proxy.settings, "vmess.security", "none")
        node = {
            "name": proxy.name,
            "type": ibtype,
            "server": proxy.server,
            "port": int(proxy.port),
            "alterId": 0,
            "cipher": "auto",
            "uuid": setting["id"],
            "tls": True if ibsecurity != "none" or security == "tls" else None,
            "udp": R(proxy.settings, "vmess.udp"),
            "skip-cert-verify": R(proxy.settings, "vmess.allow_insecure"),
            "servername": R(proxy.settings, "vmess.servername"),
            "client_fingerprint": R(proxy.settings, "vmess.fingerprint"),
            "network": R(inbound, "network"),
        }
        self.add_network_opts(node, inbound, proxy.settings.get(ibtype, {}))
        self.config["proxies"].append(node)
        return True

    def add_vless(self, proxy: Proxy):
        inbound = xray.config.inbounds_by_tag.get(proxy.inbound)
        ibtype = R(inbound, "protocol")
        ibsecurity = R(inbound, "tls", "none")
        setting = self.user.proxies.get(ibtype).dict(no_obj=True)
        security = R(proxy.settings, "vless.security", "none")

        if not self.is_clash_meta:
            return False

        # skip unsafe proxy
        if ibsecurity == "none" and security != "tls":
            return False
        
        node = {
            "name": proxy.name,
            "type": ibtype,
            "server": proxy.server,
            "port": int(proxy.port),
            "uuid": setting["id"],
            "tls": True,
            "udp": R(proxy.settings, "vless.udp"),
            "skip-cert-verify": R(proxy.settings, "vless.allow_insecure"),
            "servername":  R(proxy.settings, "vless.servername"),
            "flow": R(setting, "flow"),
            "client_fingerprint": R(proxy.settings, "vless.fingerprint"),
            "network": R(inbound, "network"),
        }
        self.add_network_opts(node, inbound, proxy.settings.get(ibtype, {}))
        self.config["proxies"].append(node)
        return True

    def add_shadowsocks(self, proxy: Proxy):
        inbound = xray.config.inbounds_by_tag.get(proxy.inbound)
        ibtype = R(inbound, "protocol")
        setting = self.user.proxies.get(ibtype).dict(no_obj=True)
        node = {
            "name": proxy.name,
            "type": "ss",
            "server": proxy.server,
            "port": int(proxy.port),
            "password": setting["password"],
            "cipher": setting["method"],
        }
        self.config["proxies"].append(node)
        return True
    
    def write_proxy(self, proxy: Proxy):
        if not self.active_inbounds.get(proxy.inbound):
            return False
        
        inbound = xray.config.inbounds_by_tag.get(proxy.inbound)
        ibtype = R(inbound, "protocol")

        if ibtype == "trojan":
            return self.add_trojan(proxy)
        elif ibtype == "shadowsocks":
            return self.add_shadowsocks(proxy)
        elif ibtype == "vmess":
            return self.add_vmess(proxy)
        elif ibtype == "vless":
            return self.add_vless(proxy)
        else:
            return False
        
    def write_proxy_group(self, obj: ProxyGroup):
        node_names = []
        for id in obj.proxies.split(','):
            proxy = self.find_proxy(id)
            if not proxy:
                continue
            node_names.append(proxy.name)

        if len(node_names) == 0:
            node_names.append('REJECT')

        group = {
            "name": obj.name,
            "type": obj.type,
            "icon": R(obj.settings, "icon"),
            "proxies": node_names,
        }
        self.config["proxy-groups"].append(group)
        
        if obj.type == "url-test":
            group["tolerance"] = R(obj.settings, "url_test.tolerance")
            group["lazy"] = R(obj.settings, "url_test.lazy")
            group["url"] = R(obj.settings, "url_test.url")
            group["interval"] = R(obj.settings, "url_test.interval")
        elif obj.type == "fallback":
            group["url"] = R(obj.settings, "fallback.url")
            group["interval"] = R(obj.settings, "fallback.interval")
        elif obj.type == "load-balance":
            group["url"] = R(obj.settings, "load_balance.url")
            group["interval"] = R(obj.settings, "load_balance.interval")
            group["strategy"] = R(obj.settings, "load_balance.strategy")
        elif obj.type == "select":
            group["disable-udp"] = R(obj.settings, "select.disable_udp")
            group["filter"] = R(obj.settings, "select.filter")
    
    def find_proxy(self, id: str):
        if id == "DIRECT" or id == "REJECT":
            return ClashConfig.BuiltinProxy(name=id)
        elif id == "...":
            return None
        elif id.startswith("#"):
            return self.proxy_groups_by_id.get(int(id[1:]))
        else:
            proxy = self.proxies_by_id.get(int(id))
            if proxy and proxy.exported:
                inbound = xray.config.inbounds_by_tag.get(proxy.inbound)
                if inbound["protocol"] != "vless" or self.is_clash_meta:
                    return proxy

    def write_proxies(self):
        node_names = []
        
        for proxy in self.proxies:
            if proxy.port.find(':') > 0:
                ports = proxy.port.split(':')
                start = int(ports[0])
                end = int(ports[1]) + 1
                lb_nodes = []
                for port in range(start, end):
                    lb_proxy = proxy.copy()
                    lb_proxy.name = f"{proxy.name}|{port - start}"
                    lb_proxy.port = port
                    if self.write_proxy(lb_proxy):
                        lb_nodes.append(lb_proxy.name)
                if len(lb_nodes) > 0:
                    self.config["proxy-groups"].append({
                        "name": proxy.name,
                        "type": "load-balance",
                        "icon": R(proxy.settings, "icon"),
                        "url": "http://cp.cloudflare.com/generate_204",
                        "interval": 300,
                        "strategy": "round-robin",
                        "proxies": lb_nodes,
                    })
                    proxy.exported = True
                    node_names.append(proxy.name)
            elif self.write_proxy(proxy):
                proxy.exported = True
                node_names.append(proxy.name)

        for proxy_group in self.proxy_groups:
            if proxy_group.builtin:
                continue
            self.write_proxy_group(proxy_group)
            node_names.append(proxy_group.name)

        builtins = [self.builtin_proxy_groups["PROXY"], 
                   self.builtin_proxy_groups["DIRECT"],
                   self.builtin_proxy_groups["MATCH"], 
                   self.builtin_proxy_groups["REJECT"]]
        builtins.reverse()
        for builtin_group in builtins:
            bg_nodes = []
            for id in builtin_group.proxies.split(','):
                proxy = self.find_proxy(id)
                if proxy:
                    bg_nodes.append(proxy.name)
                elif id == "...":
                    bg_nodes += node_names
            self.config["proxy-groups"].insert(0, {
                "name": builtin_group.name,
                "type": "select",
                "icon": R(builtin_group.settings, "icon"),
                "proxies": bg_nodes,
            })

        for ruleset in self.rulesets:
            if ruleset.builtin:
                continue
            rs_nodes = ["DIRECT", "PROXY", "REJECT"]
            rs_nodes.remove(ruleset.preferred_proxy)
            rs_nodes.insert(0, ruleset.preferred_proxy)
            rs_nodes[0] = self.builtin_proxy_groups[rs_nodes[0]].name
            rs_nodes[1] = self.builtin_proxy_groups[rs_nodes[1]].name
            rs_nodes[2] = self.builtin_proxy_groups[rs_nodes[2]].name
            rs_nodes += node_names
            self.config["proxy-groups"].append({
                "name": ruleset.name,
                "type": "select",
                "icon": R(ruleset.settings, "icon"),
                "proxies": rs_nodes,
            })

    def write_rules(self):
        for rule in self.rules:
            # TYPE,ARGUMENT,POLICY(,no-resolve)
            no_resolve=""
            policy=rule.ruleset
            if self.builtin_proxy_groups.get(policy) is not None:
                policy = self.builtin_proxy_groups[policy].name
            if len(rule.option) > 0:
                no_resolve=f",{rule.option}"
            self.config["rules"].append(f"{rule.type},{rule.content},{policy}{no_resolve}")
        
        self.config["rules"].append(f'MATCH,{self.builtin_proxy_groups["MATCH"].name}')

def generate_subscription_with_rules(
        db: Session, 
        dbuser: ClashUser, 
        config_format: Literal["v2ray", "clash-meta", "clash"]):
    
    clash = ClashConfig(db=db, dbuser=dbuser, config_format=config_format)

    # proxies
    clash.write_proxies()

    # clash rules
    clash.write_rules()

    return clash.to_yaml()
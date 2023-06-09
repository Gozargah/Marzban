import re
import yaml
import secrets
import random
from typing import Literal, Dict, Optional
import sqlalchemy
from fastapi import Depends, Header, Response, HTTPException

from fastapi import Depends, Header, Request, Response
from fastapi.responses import HTMLResponse
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
    ClashProxyInboundsResponse, ClashSettingResponse, ClashSettingCreate)

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
            tags=v.tags,
            code=v.code,
            domain=v.domain
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
        raise HTTPException(status_code=409, detail="Rule already exists")

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
        raise HTTPException(status_code=409, detail="Ruleset already exists")

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
        raise HTTPException(status_code=409, detail="Proxy already exists")

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

    crud.remove_clash_proxy(db, dbproxy)

    logger.info(f"Proxy \"{dbproxy.id}\" deleted")

    return {}

@app.post("/api/clash/proxy/group", tags=['Clash'], response_model=ClashProxyGroupResponse)
def add_clash_proxy_group(new_proxy_group: ClashProxyGroupCreate,
             db: Session = Depends(get_db),
             admin: Admin = Depends(Admin.get_current)):
    try:
        proxy_group = crud.create_clash_proxy_group(db, new_proxy_group)
    except sqlalchemy.exc.IntegrityError:
        raise HTTPException(status_code=409, detail="Proxy group already exists")

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
    
    proxies = []
    for brief in crud.get_all_clash_proxy_briefs(db):
        proxies.append(ClashProxyBriefResponse(
            id=str(brief.id),
            name=brief.name,
            tag=brief.tag,
            server=brief.server
        ))
    for brief in crud.get_all_clash_proxy_group_briefs(db):
        if not brief.builtin:
            proxies.append(ClashProxyBriefResponse(
                id=f"#{brief.id}",
                name=brief.name,
                tag=brief.tag,
                server="<Proxy Group>"
            ))
    
    proxies.sort(key=lambda v: v.name)

    return {"data": data, "proxies": proxies, "total": count}

@app.get("/api/clash/proxy/tags", tags=['Clash'], response_model=ClashProxyTagsResponse)
def get_clash_proxy_tags(db: Session = Depends(get_db),
              admin: Admin = Depends(Admin.get_current)):
    proxies, _ = crud.get_clash_proxies(db)
    proxy_groups, _ = crud.get_clash_proxy_groups(db)

    tags = []
    cache = {}
    for proxy in proxies:
        tag = str(proxy.tag) or ""
        if len(tag) > 0 and not cache.get(tag):
            cache[tag] = True
            tags.append(tag)

    for proxy in proxy_groups:
        tag = str(proxy.tag) or ""
        if not proxy.builtin and len(tag) > 0 and not cache.get(tag):
            cache[tag] = True
            tags.append(tag)
    
    tags.sort()

    return {"data": tags, "total": len(tags)}
    
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

    return {"data": inbounds, "total": len(inbounds)}

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
                     request: Request,
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
    
    if len(dbuser.domain) == 0 or len(dbuser.tags) == 0:
        return Response(status_code=204)
    
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

    if re.match('^([Cc]lashX|[Cc]lash|[Ss]tash)', user_agent):
        conf = generate_subscription_with_rules(db=db, dbuser=dbuser, config_format="clash")
    # if re.match('^([Ss]hadowrocket|[Cc]lash-verge|[Cc]lash-?[Mm]eta)', user_agent):
    else:
        conf = generate_subscription_with_rules(db=db, dbuser=dbuser, config_format="clash-meta")

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
    
    return obj if obj else default

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
        self.db = db
        self.dbuser = dbuser
        self.config_format = config_format
        self.is_clash_meta = self.config_format == "clash-meta"

        # user setting
        user = UserResponse.from_orm(dbuser.user)
        self.username = user.username
        self.user_settings = {
            "trojan": user.proxies.get(ProxyTypes.Trojan),
            "vmess": user.proxies.get(ProxyTypes.VMess),
            "vless": user.proxies.get(ProxyTypes.VLESS),
            "shadowsocks": user.proxies.get(ProxyTypes.Shadowsocks)
        }

        # setting
        self.setting = crud.get_clash_setting(db, "clash")

        # proxies and proxy group
        self.proxies: list[ClashConfig.Proxy] = []
        self.proxies_by_id: Dict[int, ClashConfig.Proxy] = {}
        self.proxy_groups: list[ClashConfig.ProxyGroup] = []
        self.proxy_groups_by_id: Dict[int, ClashConfig.ProxyGroup] = {}
        tags = str(dbuser.tags).split(",")
        for obj in crud.get_clash_proxies(db=db)[0]:
            try:
                idx = tags.index(obj.tag)
            except Exception:
                idx = -1
            if idx >= 0:
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

    def to_yaml(self):
        class Dumper(yaml.Dumper):
            def increase_indent(self, flow=False, *args, **kwargs):
                return super().increase_indent(flow=flow, indentless=False)

            def represent_mapping(self, tag, mapping, flow_style=None):
                node = super().represent_mapping(tag, mapping, flow_style)
                nones = []
                for v in node.value:
                    if str(v[1].tag).endswith(":null"):
                        nones.append(v)
                    if len(v[1].value) == 0:
                        nones.append(v)
                for v in nones:
                    node.value.remove(v)
                return node 
        
        return yaml.dump(self.config, sort_keys=False, allow_unicode=True, Dumper=Dumper)
    
    def add_network_opts(self, proxy:dict, inbound: dict, settings: dict):
        security = R(inbound, "tls", "none")
        network = R(inbound, "network")
        if network == "ws":
            username = self.username
            path = R(inbound, "path", "/")
            addition_path = R(settings, "ws_addition_path", "")
            port = inbound["port"]
            proxy["ws-opts"] = {
                "path": re.sub(r"//+", "/", f"{path}/{addition_path}?user={username}&port={port}"),
                "headers": {
                    "Host": R(inbound, "host"),
                }
            }
        elif network == "grpc":                
            proxy["grpc-opts"] = {
                "grpc-service-name": R(inbound, "path"),
            }
        elif network == "http":
            proxy["network"] = "h2"
            proxy["h2-opts"] = {
                "path": R(inbound, "path"),
                "host": R(inbound, "host"),
            }
        elif network == "tcp" and R(inbound, "header_type") == "http":
            rawinbound = xray.config.get_inbound(inbound["tag"])
            proxy["network"] = "http"
            proxy["http-opts"] = {
                "method": R(rawinbound, "streamSettings.tcpSettings.header.request.method"),
                "path": R(rawinbound, "streamSettings.tcpSettings.header.request.path"),
                "headers": R(rawinbound, "streamSettings.tcpSettings.header.request.headers"),
            }
        if security == "reality":
            salt = secrets.token_hex(8)
            sni = random.choice(inbound["sni"]).replace('*', salt)
            proxy["servername"] = sni
            proxy["reality-opts"] = {
                "public-key": inbound["pbk"],
                "short-id": inbound["sid"],
            }

    def add_trojan(self, obj: Proxy):
        inbound = xray.config.inbounds_by_tag.get(obj.inbound)
        ibtype = R(inbound, "protocol")
        ibnetwork = R(inbound, "network")
        setting = self.user_settings[ibtype].dict(no_obj=True)
        udp = R(obj.settings, "trojan.udp")
        sni = R(obj.settings, "trojan.sni")
        alpn = R(obj.settings, "trojan.alpn")
        allow_insecure = bool(R(obj.settings, "trojan.allow_insecure"))
        client_fingerprint = R(obj.settings, "trojan.fingerprint")
        proxy = {}
        proxy["name"] = obj.name
        proxy["type"] = ibtype
        proxy["server"] = obj.server
        proxy["port"] = int(obj.port)
        proxy["password"] = setting["password"]
        proxy["sni"] = sni if sni else None
        proxy["tls"] = True
        proxy["udp"] = True if udp else None
        proxy["alpn"] = alpn.split(",") if alpn else None
        proxy["skip-cert-verify"] = allow_insecure if allow_insecure else None
        proxy["client_fingerprint"] = client_fingerprint # if self.is_clash_meta else None
        proxy["network"] = ibnetwork
        self.add_network_opts(proxy, inbound, obj.settings[ibtype])
        return proxy
    
    def add_vmess(self, obj: Proxy):
        inbound = xray.config.inbounds_by_tag.get(obj.inbound)
        ibtype = R(inbound, "protocol")
        ibsecurity = R(inbound, "tls", "none")
        ibnetwork = R(inbound, "network")
        setting = self.user_settings[ibtype].dict(no_obj=True)
        udp = R(obj.settings, "vmess.udp")
        security = R(obj.settings, "vmess.security", "none")
        allow_insecure = R(obj.settings, "vmess.allow_insecure")
        servername = R(obj.settings, "vmess.servername")
        client_fingerprint = R(obj.settings, "vmess.fingerprint")
        proxy = {}
        proxy["name"] = obj.name
        proxy["type"] = ibtype
        proxy["server"] = obj.server
        proxy["port"] = int(obj.port)
        proxy["alterId"] = 0
        proxy["cipher"] = "auto"
        proxy["uuid"] = setting["id"]
        proxy["tls"] = True if ibsecurity != "none" or security == "tls" else None
        proxy["udp"] = True if udp else None
        proxy["skip-cert-verify"] = allow_insecure if allow_insecure else None
        proxy["servername"] = servername
        proxy["client_fingerprint"] = client_fingerprint # if self.is_clash_meta else None
        proxy["network"] = ibnetwork
        self.add_network_opts(proxy, inbound, obj.settings[ibtype])
        return proxy

    def add_vless(self, obj: Proxy):
        inbound = xray.config.inbounds_by_tag.get(obj.inbound)
        ibtype = R(inbound, "protocol")
        ibnetwork = R(inbound, "network")
        ibsecurity = R(inbound, "tls", "none")
        ubsetting = self.user_settings[ibtype].dict(no_obj=True)
        udp = R(obj.settings, "vless.udp")
        security = R(obj.settings, "vless.security", "none")
        allow_insecure = R(obj.settings, "vless.allow_insecure")
        servername = R(obj.settings, "vless.servername")
        flow = R(ubsetting, "flow", R(obj.settings, "vless.flow"))
        client_fingerprint = R(obj.settings, "vless.fingerprint")
        proxy = {}
        proxy["name"] = obj.name
        proxy["type"] = ibtype
        proxy["server"] = obj.server
        proxy["port"] = int(obj.port)
        proxy["uuid"] = ubsetting["id"]
        proxy["tls"] = True if ibsecurity != "none" or security == "tls" else None
        proxy["udp"] = True if udp else None
        proxy["skip-cert-verify"] = allow_insecure if allow_insecure else None
        proxy["servername"] = servername
        proxy["flow"] = flow
        proxy["client_fingerprint"] = client_fingerprint # if self.is_clash_meta else None
        proxy["network"] = ibnetwork
        self.add_network_opts(proxy, inbound, obj.settings[ibtype])
        return proxy

    def add_shadowsocks(self, obj: Proxy):
        inbound = xray.config.inbounds_by_tag.get(obj.inbound)
        ibtype = R(inbound, "protocol")
        ibnetwork = R(inbound, "network")
        ubsetting = self.user_settings[ibtype].dict(no_obj=True)
        proxy = {}
        proxy["name"] = obj.name
        proxy["type"] = "ss"
        proxy["server"] = obj.server
        proxy["port"] = int(obj.port)
        proxy["password"] = ubsetting["password"]
        proxy["cipher"] = ubsetting["method"]
        # proxy["network"] = ibnetwork
        # self.add_network_opts(proxy, inbound, obj.settings[ibtype])
        return proxy
    
    def write_proxy(self, proxies: list, obj: Proxy):
        inbound = xray.config.inbounds_by_tag.get(obj.inbound)
        ibtype = R(inbound, "protocol")
        if not ibtype or not self.user_settings[ibtype]:
            return
                
        if ibtype == "trojan":
            proxies.append(self.add_trojan(obj))
            return True
        
        if ibtype == "shadowsocks":
            proxies.append(self.add_shadowsocks(obj))
            return True
        
        if ibtype == "vmess":
            proxies.append(self.add_vmess(obj))
            return True
        
        if ibtype == "vless" and self.is_clash_meta:
            proxies.append(self.add_vless(obj))
            return True
        
    def write_proxy_group(self, proxy_groups: list, obj: ProxyGroup):
        proxies = []
        for id in obj.proxies.split(','):
            subobj = self.find_proxy(id)
            if not subobj:
                continue
            proxies.append(subobj.name)

        if len(proxies) == 0:
            proxies.append('REJECT')

        proxy = {
            "name": obj.name,
            "type": obj.type,
            "icon": R(obj.settings, "icon"),
            "proxies": proxies,
        }
        proxy_groups.append(proxy)
        
        if obj.type == "url-test":
            proxy["tolerance"] = R(obj.settings, "url_test.tolerance")
            proxy["lazy"] = R(obj.settings, "url_test.lazy")
            proxy["url"] = R(obj.settings, "url_test.url")
            proxy["interval"] = R(obj.settings, "url_test.interval")
        elif obj.type == "fallback":
            proxy["url"] = R(obj.settings, "fallback.url")
            proxy["interval"] = R(obj.settings, "fallback.interval")
        elif obj.type == "load-balance":
            proxy["url"] = R(obj.settings, "load_balance.url")
            proxy["interval"] = R(obj.settings, "load_balance.interval")
            proxy["strategy"] = R(obj.settings, "load_balance.strategy")
        elif obj.type == "select":
            proxy["disable-udp"] = R(obj.settings, "select.disable_udp")
            proxy["filter"] = R(obj.settings, "select.filter")

        return proxy
    
    def find_proxy(self, id: str):
        if id == "DIRECT" or id == "REJECT":
            return ClashConfig.BuiltinProxy(name=id)
        elif id == "...":
            return None
        elif id.startswith("#"):
            obj = self.proxy_groups_by_id.get(int(id[1:]))
            if obj:
                return obj
        else:
            obj = self.proxies_by_id.get(int(id))
            if obj and obj.exported:
                inbound = xray.config.inbounds_by_tag.get(obj.inbound)
                if inbound["protocol"] != "vless" or self.is_clash_meta:
                    return obj

    def write_proxies(self):
        proxy_names = []
        proxies = []
        proxy_groups = []
        self.config["proxies"] = proxies
        self.config["proxy-groups"] = proxy_groups

        for obj in self.proxies:
            if obj.port.find(':') > 0:
                ports = obj.port.split(':')
                start = int(ports[0])
                end = int(ports[1]) + 1
                lb_proxies = []
                for port in range(start, end):
                    subobj = obj.copy()
                    subobj.name = f"{obj.name}|{port - start}"
                    subobj.port = port
                    if self.write_proxy(proxies, subobj):
                        lb_proxies.append(subobj.name)
                if len(lb_proxies) > 0:
                    proxy_groups.append({
                        "name": obj.name,
                        "type": "load-balance",
                        "icon": R(obj.settings, "icon"),
                        "url": "http://cp.cloudflare.com/generate_204",
                        "interval": 300,
                        "strategy": "round-robin",
                        "proxies": lb_proxies,
                    })
                    obj.exported = True
                    proxy_names.append(obj.name)
            elif self.write_proxy(proxies, obj):
                obj.exported = True
                proxy_names.append(obj.name)

        for obj in self.proxy_groups:
            if obj.builtin:
                continue
            if self.write_proxy_group(proxy_groups, obj):
                proxy_names.append(obj.name)

        builtin = [self.builtin_proxy_groups["PROXY"], 
                   self.builtin_proxy_groups["DIRECT"],
                   self.builtin_proxy_groups["MATCH"], 
                   self.builtin_proxy_groups["REJECT"]]
        builtin.reverse()
        for obj in builtin:
            pg_proxies = []
            for id in obj.proxies.split(','):
                subobj = self.find_proxy(id)
                if subobj:
                    pg_proxies.append(subobj.name)
                elif id == "...":
                    pg_proxies += proxy_names
            proxy_groups.insert(0, {
                "name": obj.name,
                "type": "select",
                "icon": R(obj.settings, "icon"),
                "proxies": pg_proxies,
            })

        for obj in self.rulesets:
            if obj.builtin:
                continue
            rs_names = ["DIRECT", "PROXY", "REJECT"]
            rs_names.remove(obj.preferred_proxy)
            rs_names.insert(0, obj.preferred_proxy)
            rs_names[0] = self.builtin_proxy_groups[rs_names[0]].name
            rs_names[1] = self.builtin_proxy_groups[rs_names[1]].name
            rs_names[2] = self.builtin_proxy_groups[rs_names[2]].name
            rs_names += proxy_names
            proxy_groups.append({
                "name": obj.name,
                "type": "select",
                "icon": R(obj.settings, "icon"),
                "proxies": rs_names,
            })

    def write_rules(self):
        rules = []
        for obj in self.rules:
            # TYPE,ARGUMENT,POLICY(,no-resolve)
            no_resolve=""
            policy=obj.ruleset
            if self.builtin_proxy_groups.get(policy) is not None:
                policy = self.builtin_proxy_groups[policy].name
            if len(obj.option) > 0:
                no_resolve=f",{obj.option}"
            rules.append(f"{obj.type},{obj.content},{policy}{no_resolve}")
        rules.append(f'MATCH,{self.builtin_proxy_groups["MATCH"].name}')
        self.config["rules"] = rules

def generate_subscription_with_rules(
        db: Session, 
        dbuser: ClashUser, 
        config_format: Literal["v2ray", "clash-meta", "clash"]):
    
    clash = ClashConfig(db=db, dbuser=dbuser, config_format=config_format)

    if len(clash.proxies) == 0:
        return ""

    # proxies
    clash.write_proxies()

    # clash rules
    clash.write_rules()

    return clash.to_yaml()
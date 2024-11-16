import re
import base64
import yaml
import secrets
import random
from typing import Dict, Optional
import sqlalchemy
from fastapi import Depends, Response, HTTPException, status, APIRouter

from app import app, logger, xray
from app.db import Session, crud, get_db
from app.db.models import User
from app.subscription.share import SERVER_IP

from app.models.user import UserResponse
from app.models.admin import Admin
from app.models.clash import (ClashRulesResponse, ClashRuleResponse,
    ClashRulesetsResponse, ClashProxyGroupsResponse, ClashProxiesResponse,
    ClashRuleCreate, ClashRulesetResponse, ClashRulesetCreate,
    ClashProxyGroupResponse, ClashProxyGroupCreate, 
    ClashProxyTagsResponse, ClashProxyBriefResponse,
    ClashProxyResponse, ClashProxyCreate, ClashProxyInboundResponse, 
    ClashProxyInboundsResponse, ClashSettingResponse, ClashSettingCreate,
    ClashProxyTagResponse, ClashProxyBriefsResponse, ClashSettingsResponse)

router = APIRouter(tags=['Clash'], prefix='/api')

RULESET_POLICIES = ["DIRECT", "PROXY", "REJECT"]
RULE_POLICIES = ["", "DIRECT", "PROXY", "REJECT"]
RULE_TYPES = ["GEOSITE", "NETWORK", "RULE-SET", "DOMAIN", "DOMAIN-SUFFIX",
             "DOMAIN-KEYWORD", "SRC-IP-CIDR", "SRC-PORT", "DST-PORT",
             "PROCESS-NAME", "PROCESS-PATH", "AND", "OR", "NOT",
             "GEOIP", "IP-CIDR", "IP-CIDR6", "SCRIPT"]

def HTTPException400(err: str, msg: str):
    return HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail={"err": err, "message": msg})

def HTTPException404(msg: str):
    return HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=msg)

def HTTPException409(err: str, msg: str):
    return HTTPException(status_code=status.HTTP_409_CONFLICT, detail={"err": err, "message": msg})

@router.post("/clash/rule", tags=['Clash'], response_model=ClashRuleResponse)
def add_clash_rule(created: ClashRuleCreate,
             db: Session = Depends(get_db),
             admin: Admin = Depends(Admin.get_current)):

    dbruleset = crud.get_clash_ruleset(db=db, name=created.ruleset)
    if not dbruleset:
        raise HTTPException404("Ruleset not found")
    
    if not created.policy in RULE_POLICIES:
        raise HTTPException400("InvalidRulePolicy", "Invalid rule policy")
    
    if not created.type in RULE_TYPES:
        raise HTTPException400("InvalidRuleType", "Invalid rule type")
    
    created.ruleset_id = dbruleset.id

    try:
        dbrule = crud.create_clash_rule(db, created)
    except sqlalchemy.exc.IntegrityError:
        raise HTTPException409("RuleExists", "Rule already exists")

    logger.info(f"New rule \"{dbrule.content}\" added")
    return dbrule

@router.put("/clash/rule/{id}", tags=['Clash'], response_model=ClashRuleResponse)
def modify_clash_rule(id: int,
                modified: ClashRuleCreate,
                db: Session = Depends(get_db),
                admin: Admin = Depends(Admin.get_current)):

    dbrule = crud.get_clash_rule(db, id)
    if not dbrule:
        raise HTTPException404("Rule not found")
    
    if not modified.policy in RULE_POLICIES:
        raise HTTPException400("InvalidRulePolicy", "Invalid rule policy")

    if not modified.type in RULE_TYPES:
        raise HTTPException400("InvalidRuleType", "Invalid rule type")

    dbruleset = crud.get_clash_ruleset(db=db, name=modified.ruleset)
    if not dbruleset:
        raise HTTPException400("RulesetNotFound", "Ruleset not found")

    modified.ruleset_id = dbruleset.id
    crud.update_clash_rule(db, dbrule, modified)

    logger.info(f"Rule \"{dbrule.id}\" modified")

    return dbrule

@router.delete("/clash/rule/{id}", tags=['Clash'])
def delete_clash_rule(id: int,
                db: Session = Depends(get_db),
                admin: Admin = Depends(Admin.get_current)):

    dbrule = crud.get_clash_rule(db, id)
    if not dbrule:
        raise HTTPException404("Rule not found")

    crud.remove_clash_rule(db, dbrule)

    logger.info(f"Rule \"{dbrule.id}\" deleted")

    return {}

@router.post("/clash/ruleset", tags=['Clash'], response_model=ClashRulesetResponse)
def add_clash_ruleset(created: ClashRulesetCreate,
             db: Session = Depends(get_db),
             admin: Admin = Depends(Admin.get_current)):
    try:
        dbruleset = crud.create_clash_ruleset(db, created)
    except sqlalchemy.exc.IntegrityError:
        raise HTTPException409("RulesetExists", "Ruleset already exists")
    
    if not created.policy in RULESET_POLICIES:
        raise HTTPException400("InvalidRulesetPolicy", "Invalid ruleset policy")

    logger.info(f"New ruleset \"{dbruleset.name}\" added")
    return dbruleset

@router.put("/clash/ruleset/{id}", tags=['Clash'], response_model=ClashRulesetResponse)
def modify_clash_ruleset(id: int,
                modified: ClashRulesetCreate,
                db: Session = Depends(get_db),
                admin: Admin = Depends(Admin.get_current)):

    dbruleset = crud.get_clash_ruleset(db=db, id=id)
    if not dbruleset:
        raise HTTPException404("Ruleset not found")
    
    if not modified.policy in RULESET_POLICIES:
        raise HTTPException400("InvalidRulesetPolicy", "Invalid ruleset policy")
    
    if dbruleset.builtin:
        modified.policy = dbruleset.policy
        modified.name = dbruleset.name

    crud.update_clash_ruleset(db, dbruleset, modified)

    logger.info(f"Ruleset \"{dbruleset.id}\" modified")

    return dbruleset

@router.delete("/clash/ruleset/{id}", tags=['Clash'])
def delete_clash_ruleset(id: int,
                db: Session = Depends(get_db),
                admin: Admin = Depends(Admin.get_current)):

    dbruleset = crud.get_clash_ruleset(db=db, id=id)
    if not dbruleset:
        raise HTTPException404("Ruleset not found")

    crud.remove_clash_ruleset(db, dbruleset)

    logger.info(f"Ruleset \"{dbruleset.id}\" deleted")

    return {}

@router.get("/clash/rules", tags=['Clash'], response_model=ClashRulesResponse)
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
                raise HTTPException400("InvalidSortOption", f'"{opt}" is not a valid sort option')

    data, count = crud.get_clash_rules(db=db, 
                                  offset=offset,
                                  limit=limit,
                                  search=search,
                                  ruleset=ruleset,
                                  sort=sort)
    
    return {"data": data, "total": count}


@router.get("/clash/rulesets", tags=['Clash'], response_model=ClashRulesetsResponse)
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

@router.get("/clash/proxies", tags=['Clash'], response_model=ClashProxiesResponse)
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
                raise HTTPException400("InvalidSortOption", f'"{opt}" is not a valid sort option')

    data, count = crud.get_clash_proxies(db=db, 
                                  offset=offset,
                                  limit=limit,
                                  search=search,
                                  sort=sort)

    return {"data": data, "total": count}

@router.post("/clash/proxy", tags=['Clash'], response_model=ClashProxyResponse)
def add_clash_proxy(created: ClashProxyCreate,
             db: Session = Depends(get_db),
             admin: Admin = Depends(Admin.get_current)):
    
    if not xray.config.inbounds_by_tag.get(created.inbound):
        raise HTTPException400("InboundNotFound", "Inbound not found")
    
    try:
        dbproxy = crud.create_clash_proxy(db, created)
    except sqlalchemy.exc.IntegrityError:
        raise HTTPException409("ProxyExists", "Proxy already exists")

    logger.info(f"New proxy \"{dbproxy.name}\" added")
    return dbproxy

@router.put("/clash/proxy/{id}", tags=['Clash'], response_model=ClashProxyResponse)
def modify_clash_proxy(id: int,
                modified: ClashProxyCreate,
                db: Session = Depends(get_db),
                admin: Admin = Depends(Admin.get_current)):

    dbproxy = crud.get_clash_proxy(db, id)
    if not dbproxy:
        raise HTTPException404("Proxy not found")
    
    if not dbproxy.builtin and modified.tag.lower() == "built-in":
        raise HTTPException400("BuiltinTagError", "Tag 'built-in' is not valid tag.")

    if not xray.config.inbounds_by_tag.get(modified.inbound):
        raise HTTPException400("InboundNotFound", "Inbound not found")

    crud.update_clash_proxy(db, dbproxy, modified)

    logger.info(f"Proxy \"{dbproxy.id}\" modified")

    return dbproxy

@router.delete("/clash/proxy/{id}", tags=['Clash'])
def delete_clash_proxy(id: int,
                db: Session = Depends(get_db),
                admin: Admin = Depends(Admin.get_current)):

    dbproxy = crud.get_clash_proxy(db, id)
    if not dbproxy:
        raise HTTPException404("Proxy not found")
    
    inbound = xray.config.inbounds_by_tag.get(dbproxy.inbound)
    crud.remove_clash_proxy(db, dbproxy)
    logger.info(f"Proxy \"{dbproxy.id}\" deleted")
    return {}

@router.post("/clash/proxy/group", tags=['Clash'], response_model=ClashProxyGroupResponse)
def add_clash_proxy_group(created: ClashProxyGroupCreate,
             db: Session = Depends(get_db),
             admin: Admin = Depends(Admin.get_current)):
    try:
        dbproxy_group = crud.create_clash_proxy_group(db, created)
    except sqlalchemy.exc.IntegrityError:
        raise HTTPException409("ProxyGroupExists", "Proxy group already exists")
    
    if not dbproxy_group.builtin and created.tag.lower() == "built-in":
        raise HTTPException400("BuiltinTagError", "Tag 'built-in' is not valid tag.")

    logger.info(f"New proxy group \"{dbproxy_group.name}\" added")
    return dbproxy_group

@router.put("/clash/proxy/group/{id}", tags=['Clash'], response_model=ClashProxyGroupResponse)
def modify_clash_proxy_group(id: int,
                modified: ClashProxyGroupCreate,
                db: Session = Depends(get_db),
                admin: Admin = Depends(Admin.get_current)):

    dbproxy_group = crud.get_clash_proxy_group(db, id)
    if not dbproxy_group:
        raise HTTPException404("Proxy group not found")
    
    if not dbproxy_group.builtin and modified.tag.lower() == "built-in":
        raise HTTPException400("BuiltinTagError", "Tag 'built-in' is not valid tag.")

    crud.update_clash_proxy_group(db, dbproxy_group, modified)

    logger.info(f"Proxy group \"{dbproxy_group.id}\" modified")

    return dbproxy_group

@router.delete("/clash/proxy/group/{id}", tags=['Clash'])
def delete_clash_proxy_group(id: int,
                db: Session = Depends(get_db),
                admin: Admin = Depends(Admin.get_current)):

    dbproxy_group = crud.get_clash_proxy_group(db, id)
    if not dbproxy_group:
        raise HTTPException404("Proxy group not found")
    
    if dbproxy_group.builtin:
        raise HTTPException400("BuitlinProxyGroup", "Proxy group is builtin")

    crud.remove_clash_proxy_group(db, dbproxy_group)

    logger.info(f"Proxy group \"{dbproxy_group.id}\" deleted")

    return {}

@router.get("/clash/proxy/groups", tags=['Clash'], response_model=ClashProxyGroupsResponse)
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
                raise HTTPException400("InvalidSortOption", f'"{opt}" is not a valid sort option')

    data, count = crud.get_clash_proxy_groups(db=db, 
                                  offset=offset,
                                  limit=limit,
                                  search=search,
                                  sort=sort)

    return {"data": data, "total": count}

@router.get("/clash/proxy/briefs", tags=['Clash'], response_model=ClashProxyBriefsResponse)
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

@router.get("/clash/proxy/tags", tags=['Clash'], response_model=ClashProxyTagsResponse)
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
    
@router.get("/clash/proxy/inbounds", tags=['Clash'], response_model=ClashProxyInboundsResponse)
def get_clash_proxy_inbounds(db: Session = Depends(get_db),
              admin: Admin = Depends(Admin.get_current)):
    inbounds = []

    for ib in xray.config.inbounds:
        sni = ""
        if ib["tls"] == "reality":
            salt = secrets.token_hex(8)
            sni = random.choice(ib["sni"]).replace('*', salt)

        inbounds.append(ClashProxyInboundResponse(
            name=ib["tag"],
            server=SERVER_IP,
            type=ib["protocol"],
            security=ib["tls"] if ib["tls"] else "none",
            network=ib["network"],
            servername=sni,
            port=ib["port"]
        ))
    
    inbounds.sort(key=lambda v: v.name)

    return {"data": inbounds}

@router.get("/clash/settings", tags=['Clash'], response_model=ClashSettingsResponse)
def get_clash_settings(
             db: Session = Depends(get_db),
             admin: Admin = Depends(Admin.get_current)):

    data, count = crud.get_clash_settings(db=db)
    
    return {"data": data, "total": count}

@router.put("/clash/setting/{name}", tags=['Clash'], response_model=ClashSettingResponse)
def modify_clash_setting(name: str,
                modified: ClashSettingCreate,
                db: Session = Depends(get_db),
                admin: Admin = Depends(Admin.get_current)):

    dbsetting = crud.get_clash_setting(db=db, name=name)
    if not dbsetting:
        raise HTTPException404("Setting not found")

    crud.update_clash_setting(db, dbsetting, modified)

    logger.info(f"Setting \"{dbsetting.name}\" modified")

    return dbsetting


def generate_subscription(db: Session, dbuser: User, user_agent: str):
    def get_subscription_user_info(user: UserResponse) -> dict:
        return {
            "upload": 0,
            "download": user.used_traffic,
            "total": user.data_limit,
            "expire": user.expire,
        }
    
    user: UserResponse = UserResponse.from_orm(dbuser)

    response_headers = {
        "content-disposition": f'attachment; filename="{dbuser.username}"',
        "profile-update-interval": "6",
        "subscription-userinfo": "; ".join(
            f"{key}={val}"
            for key, val in get_subscription_user_info(user).items()
            if val is not None
        )
    }

    nocase_ua = user_agent.lower()
    option = ClashConfig.Option()

    if re.match('^shadowrocket', nocase_ua):
        option.support_reality = True
        option.support_vless = True
        option.support_rule_script = True
        option.support_rule_logic = True
        option.support_rule_provider = True
    elif re.match('^(clash-verge|clash-?meta|clashx meta)', nocase_ua):
        option.support_reality = True
        option.support_vless = True
        option.support_rule_geosite = True
        option.support_rule_provider = True
        option.support_rule_logic = True
        option.support_rule_network = True
        option.setting = "clash-meta"
    elif re.match("^stash", nocase_ua):
        option.support_vless = True
        option.support_rule_geosite = True
        option.support_rule_provider = True
        option.support_rule_script = True
    elif re.match('^(clashforwindows|clashx|clashforandroid.*.premium)', nocase_ua):
        option.support_rule_provider = True
        option.support_rule_script = True
    elif re.match('^clash', nocase_ua):
        option.support_rule_script = True
    else:
        option.is_v2ray = True

    logger.info(f"Generate subscription: ua={user_agent} option={option}")

    if option.is_v2ray:
        content = "\n".join(generate_v2ray_links(dbuser.username, db))
        content = base64.b64encode(content.encode()).decode()
        return Response(content=content, media_type="text/plain", headers=response_headers)
    else:
        content = generate_subscription_with_rules(db=db, dbuser=dbuser, option=option)
        return Response(content=content, media_type="text/yaml", headers=response_headers)
    
def R(obj, field: str, default = None):
    try:
        for key in field.split('.'):
            obj = obj.get(key, default)
    except Exception:
        return default
    return obj if obj is not None else default

class ClashConfig:
    class Option:
        setting: str = "clash"
        is_v2ray: bool = False
        support_reality: bool = False
        support_vless: bool = False
        support_rule_provider: bool = False
        support_rule_geosite: bool = False
        support_rule_script: bool = False
        support_rule_logic:bool = False
        support_rule_network:bool = False

        def __str__(self) -> str:
            strs = [
                f"reality={self.support_reality}",
                f"vless={self.support_vless}",
                f"rule_provider={self.support_rule_provider}",
                f"rule_geosite={self.support_rule_geosite}",
                f"rule_script={self.support_rule_script}",
                f"rule_logic={self.support_rule_logic}",
                f"rule_network={self.support_rule_network}",
            ]
            return "{" + ",".join(strs) + "}"

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

    def __init__(self, db: Session, dbuser: User, option: Option) -> None:
        self.option = option
        self.db = db
        self.dbuser = dbuser

        # user setting
        self.protocol_settings = {p.type: p.settings for p in dbuser.proxies}
        self.active_inbounds = {ib: True for _, l in dbuser.inbounds.items() for ib in l}

        self.setting = crud.get_clash_setting(self.db, self.option.setting)
        self.proxies: list[ClashConfig.Proxy] = []
        self.proxies_by_id: Dict[int, ClashConfig.Proxy] = {}
        self.proxy_groups: list[ClashConfig.ProxyGroup] = []
        self.proxy_groups_by_id: Dict[int, ClashConfig.ProxyGroup] = {}
        self.builtin_proxy_groups: Dict[str, ClashConfig.ProxyGroup] = {}
        self.rulesets: list[ClashConfig.Ruleset] = []
        self.rules: list[ClashConfig.Rule] = []

        self.config = yaml.safe_load(self.setting.content)
        self.config["proxies"] = []
        self.config["proxy-groups"] = []
        self.config["rule-providers"] = {}
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

    def init_proxies(self):
        tags = str(self.dbuser.sub_tags).split(",") if self.dbuser.sub_tags else []
        for obj in crud.get_clash_proxies(db=self.db)[0]:
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
        self.proxies.sort(key=lambda v: v.tag_index)

        for obj in crud.get_clash_proxy_groups(db=self.db)[0]:
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
        
        self.proxy_groups.sort(key=lambda v: v.tag_index)
        self.builtin_proxy_groups["DIRECT"] = self.proxy_groups_by_id.get(1)
        self.builtin_proxy_groups["PROXY"] = self.proxy_groups_by_id.get(2)
        self.builtin_proxy_groups["MATCH"] = self.proxy_groups_by_id.get(3)
        self.builtin_proxy_groups["REJECT"] = self.proxy_groups_by_id.get(4)

    def init_rulesets(self):
        sorted0 = {"REJECT": 0}
        sorted1 = {
            "NETWORK": 1, "RULE-SET": 2,
            "DOMAIN": 10, "DOMAIN-SUFFIX": 11, "GEOSITE": 12, "DOMAIN-KEYWORD": 13,
            "SRC-IP-CIDR": 20, "SRC-PORT": 21, "DST-PORT": 22,
            "PROCESS-NAME": 30, "PROCESS-PATH": 31,
            "AND": 40, "OR":  41, "NOT": 42,
            # no-reslove
            "GEOIP": 50, "IP-CIDR": 50, "IP-CIDR6": 50, "SCRIPT": 50,
        }
        sorted2 = {"GEOIP": 1}
        
        for ruleset in crud.get_clash_rulesets(self.db):
            self.rulesets.append(ClashConfig.Ruleset.from_orm(ruleset))

            if ruleset.policy == "REJECT":
                sorted0[ruleset.name] = 0

            for obj in ruleset.rules:
                self.rules.append(ClashConfig.Rule.from_orm(obj))

        self.rules.sort(key=lambda r:(
            sorted0.get(r.policy or r.ruleset, 1),
            -r.priority,
            sorted1[r.type],
            -len(r.option),
            sorted2.get(r.type, 0)
        ))
    
    def is_support_vless(self, inbound):
        ibsecurity = R(inbound, "tls", "none")
        return self.option.support_vless and (self.option.support_reality or ibsecurity != "reality")
    
    def add_network_opts(self, node:dict, inbound: dict, settings: dict):
        salt = secrets.token_hex(8)
        security = R(inbound, "tls", "none")
        network = R(inbound, "network")
        
        if network not in ('tcp', 'kcp'):
            node["flow"] = None

        if network == "ws":
            path = R(settings, "ws_opts_path") or R(inbound, "path") or "/"
            host = R(settings, "ws_opts_host") or R(inbound, "host")
            node["ws-opts"] = {
                "path": path,
                "headers": {
                    "Host": host,
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
            if not node.get("client-fingerprint"):
                node["client-fingerprint"] = "chrome"

    def add_trojan(self, proxy: Proxy):
        inbound = xray.config.inbounds_by_tag.get(proxy.inbound)
        ibtype = R(inbound, "protocol")
        ibsecurity = R(inbound, "tls", "none")
        setting = self.protocol_settings.get(ibtype)
        security = R(proxy.settings, "trojan.security", "none")

        # skip unsafe proxy
        if ibsecurity == "none" and security != "tls":
            return False

        node = {
            "name": proxy.name,
            "type": ibtype,
            "server": proxy.server,
            "port": int(proxy.port),
            "inbound": proxy.inbound if self.option.is_v2ray else None,
            "password": setting["password"],
            "sni": R(proxy.settings, "trojan.sni"),
            "tls": True,
            "udp": R(proxy.settings, "trojan.udp"),
            "alpn": R(proxy.settings, "trojan.alpn", "").split(","),
            "skip-cert-verify": R(proxy.settings, "trojan.allow_insecure"),
            "client-fingerprint": R(proxy.settings, "trojan.fingerprint"),
            "network": R(inbound, "network"),
        }
        self.add_network_opts(node, inbound, proxy.settings.get(ibtype, {}))
        self.config["proxies"].append(node)
        return True
    
    def add_vmess(self, proxy: Proxy):
        inbound = xray.config.inbounds_by_tag.get(proxy.inbound)
        ibtype = R(inbound, "protocol")
        ibsecurity = R(inbound, "tls", "none")
        setting = self.protocol_settings.get(ibtype)
        security = R(proxy.settings, "vmess.security", "none")
        node = {
            "name": proxy.name,
            "type": ibtype,
            "server": proxy.server,
            "inbound": proxy.inbound if self.option.is_v2ray else None,
            "port": int(proxy.port),
            "alterId": 0,
            "cipher": "auto",
            "uuid": setting["id"],
            "tls": True if ibsecurity != "none" or security == "tls" else None,
            "udp": R(proxy.settings, "vmess.udp"),
            "alpn": R(proxy.settings, "vmess.alpn", "").split(","),
            "skip-cert-verify": R(proxy.settings, "vmess.allow_insecure"),
            "servername": R(proxy.settings, "vmess.servername"),
            "client-fingerprint": R(proxy.settings, "vmess.fingerprint"),
            "network": R(inbound, "network"),
        }
        self.add_network_opts(node, inbound, proxy.settings.get(ibtype, {}))
        self.config["proxies"].append(node)
        return True

    def add_vless(self, proxy: Proxy):
        inbound = xray.config.inbounds_by_tag.get(proxy.inbound)
        ibtype = R(inbound, "protocol")
        ibsecurity = R(inbound, "tls", "none")
        setting = self.protocol_settings.get(ibtype)
        security = R(proxy.settings, "vless.security", "none")

        if not self.is_support_vless(inbound):
            return False

        # skip unsafe proxy
        if ibsecurity == "none" and security != "tls":
            return False
        
        node = {
            "name": proxy.name,
            "type": ibtype,
            "server": proxy.server,
            "inbound": proxy.inbound if self.option.is_v2ray else None,
            "port": int(proxy.port),
            "uuid": setting["id"],
            "tls": True,
            "udp": R(proxy.settings, "vless.udp"),
            "alpn": R(proxy.settings, "vless.alpn", "").split(","),
            "skip-cert-verify": R(proxy.settings, "vless.allow_insecure"),
            "servername":  R(proxy.settings, "vless.servername"),
            "flow": R(setting, "flow"),
            "client-fingerprint": R(proxy.settings, "vless.fingerprint"),
            "network": R(inbound, "network"),
        }
        self.add_network_opts(node, inbound, proxy.settings.get(ibtype, {}))
        self.config["proxies"].append(node)
        return True

    def add_shadowsocks(self, proxy: Proxy):
        inbound = xray.config.inbounds_by_tag.get(proxy.inbound)
        ibtype = R(inbound, "protocol")
        setting = self.protocol_settings.get(ibtype)
        cipher = R(setting, "method")
        node = {
            "name": proxy.name,
            "type": "ss",
            "server": proxy.server,
            "inbound": proxy.inbound if self.option.is_v2ray else None,
            "port": int(proxy.port),
            "password": setting["password"],
            "cipher": "chacha20-ietf-poly1305" if cipher == "chacha20-poly1305" else cipher,
            "udp": R(proxy.settings, "shadowsocks.udp"),
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
            "hidden": R(obj.settings, "hidden"),
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
                if inbound["protocol"] != "vless" or self.is_support_vless(inbound):
                    return proxy
                
    def is_hidden(self, proxy: Proxy):
        if not self.active_inbounds.get(proxy.inbound):
            return False

        return R(proxy.settings, "hidden") == True

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
                        "hidden": True,
                        "proxies": lb_nodes,
                    })
                    proxy.exported = True
                    if not self.is_hidden(proxy):
                        node_names.append(proxy.name)
            elif self.write_proxy(proxy):
                proxy.exported = True
                if not self.is_hidden(proxy):
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
            rs_nodes.remove(ruleset.policy)
            rs_nodes.insert(0, ruleset.policy)
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

    def is_support_rule(self, rule):
        if rule == "GEOSITE":
            return self.option.support_rule_geosite
        elif rule == "NETWORK":
            return self.option.support_rule_network
        elif rule in ("AND", "OR", "NOT"):
            return self.option.support_rule_logic
        elif rule == "SCRIPT":
            return self.option.support_rule_script
        elif rule == "RULE-SET":
            return self.option.support_rule_provider
        else:
            return True
        
    def write_rule_providers(self):
        if not self.option.support_rule_provider:
            return
        
        for ruleset in self.rulesets:
            as_provider = R(ruleset.settings, "as_provider")
            if ruleset.builtin or not as_provider:
                continue
            behavior = R(ruleset.settings, "behavior")
            type = R(ruleset.settings, "type")
            url = R(ruleset.settings, "url")
            path = R(ruleset.settings, "path")
            format = R(ruleset.settings, "format")
            interval = R(ruleset.settings, "interval")
            self.config["rule-providers"][ruleset.name] = {
                "behavior": behavior,
                "type": type,
                "format": format,
                "url": url,
                "path": path,
                "interval": interval,
            }
            self.config["rules"].append(f"RULE-SET,{ruleset.name},{ruleset.name}")

    def write_rules(self):
        for rule in self.rules:
            # TYPE,ARGUMENT,POLICY(,no-resolve)
            no_resolve=""
            policy = rule.policy or rule.ruleset
            if not self.is_support_rule(rule.type):
                continue
            if self.builtin_proxy_groups.get(policy) is not None:
                policy = self.builtin_proxy_groups[policy].name
            if len(rule.option) > 0:
                no_resolve=f",{rule.option}"
            self.config["rules"].append(f"{rule.type},{rule.content},{policy}{no_resolve}")
        
        self.config["rules"].append(f'MATCH,{self.builtin_proxy_groups["MATCH"].name}')

def generate_subscription_with_rules(
        db: Session, 
        dbuser: User, 
        option: ClashConfig.Option):
    
    clash = ClashConfig(db=db, dbuser=dbuser, option=option)
    clash.init_proxies()
    clash.init_rulesets()
    clash.write_proxies()
    clash.write_rule_providers()
    clash.write_rules()

    return clash.to_yaml()

def generate_v2ray_links(username: str, db: Session = next(get_db())):
    dbuser = crud.get_user(db, username)
    option = ClashConfig.Option()
    option.support_reality = True
    option.support_vless = True
    option.is_v2ray = True
    clash = ClashConfig(db=db, dbuser=dbuser, option=option)
    clash.init_proxies()
    clash.write_proxies()

    links = []
    salt = secrets.token_hex(8)

    for proxy in clash.config["proxies"]:
        inbound = xray.config.inbounds_by_tag.get(proxy["inbound"]).copy()
        settings = clash.protocol_settings.get(inbound["protocol"])

        port = proxy["port"]
        sni = R(proxy, "sni", R(proxy, "servername", ""))
        fp = R(proxy, "client-fingerprint", R(inbound, "fp", ""))
        tls = R(inbound, "tls", "none")
        alpn = R(proxy, "alpn", "")
        host = R(proxy, "host", "")

        if not sni:
            sni_list = inbound["sni"]
            if sni_list:
                sni = random.choice(sni_list).replace("*", salt)

        if not host:
            host_list = inbound["host"]
            if host_list:
                host = random.choice(host_list).replace("*", salt)

        if alpn:
            alpn = ",".join(alpn)
        else:
            alpn = R(inbound, "alpn", "")

        if tls == "none" and proxy.get("tls"):
            tls = "tls"

        inbound.update({
            "port": port,
            "sni": sni,
            "host": host,
            "fp": fp,
            "tls": tls,
            "alpn": alpn,
        })

        # links.append(get_v2ray_link(
        #     remark=proxy["inbound"],
        #     address=proxy["server"],
        #     inbound=inbound,
        #     settings=settings))

    return links
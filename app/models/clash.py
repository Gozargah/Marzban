import re
import json
from cryptography import x509
from cryptography.hazmat.backends import default_backend
from pydantic import BaseModel, Field, validator
from typing import List, Optional

RULE_CONTENT_REGEXP = re.compile(r'^(?=.{1,128}\b)[\w\-/.:,()]+$')
RULESET_NAME_REGEXP = re.compile(r'^(?=.{1,32}\b)[\w]+$')
PROXY_NAME_REGEXP = re.compile(r'^(?=.{1,64}\b)[^\'"]+$')
PROXY_TAG_REGEXP = re.compile(r'^(?=.{1,64}\b)[\w\-.:@#]+$')
PROXY_INBOUND_REGEXP = re.compile(r'^(?=.{1,64}\b)[\w ]+$')
PROXY_PORT_REGEXP = re.compile(r'^(?=.{1,11}\b)[0-9:]+$')
PROXY_SERVER_REGEXP = re.compile(r'^(?=.{1,64}\b)[\w\-./]+$')
PROXY_GROUP_PROXIES_REGEXP = re.compile(r'^(?=.{1,512})[\w,#\.]+$')

def value_error(err: str, message: str):
    return ValueError(json.dumps({"err": err, "message": message}))

class ClashSetting(BaseModel):
    name: str
    content: str

class ClashSettingCreate(ClashSetting):
    pass

class ClashSettingResponse(ClashSetting):
    class Config:
        orm_mode = True

class ClashSettingsResponse(BaseModel):
    data: List[ClashSettingResponse]
    total: int

class ClashProxy(BaseModel):
    name: str
    server: str
    builtin: Optional[bool] = False
    tag: str
    port: str
    inbound: str
    settings: dict

    @validator('name', check_fields=False)
    def validate_name(cls, v):
        if not PROXY_NAME_REGEXP.match(v):
            raise value_error('InvalidProxyName', 'name not accept quotes')
        return v
    
    @validator('tag', check_fields=False)
    def validate_tag(cls, v):
        if not PROXY_TAG_REGEXP.match(v):
            raise value_error('InvalidProxyTag', 'tag only accept "A-Za-z0-9_:-.@#"')
        return v
    
    @validator('port', check_fields=False)
    def validate_port(cls, v):
        if not PROXY_PORT_REGEXP.match(v):
            raise value_error('InvalidProxyPort', 'port only accept "0-9:"')
        return v
    
    @validator('server', check_fields=False)
    def validate_server(cls, v):
        if not PROXY_SERVER_REGEXP.match(v):
            raise value_error('InvalidProxyServer', 'server only accept "A-Za-z0-9/-._"')
        return v
    
    @validator('inbound', check_fields=False)
    def validate_inbound(cls, v):
        if not PROXY_INBOUND_REGEXP.match(v):
            if not v or v.count() == 0:
                raise value_error('NoProxyInbound', 'no proxies selected')
            else:
                raise ValueError('inbound only accept "A-Za-z0-9 "')
        return v

class ClashProxyCreate(ClashProxy):
    pass

class ClashProxyBriefResponse(BaseModel):
    id: str
    name: str
    server: str
    tag: str
    builtin: bool

class ClashProxyBriefsResponse(BaseModel):
    data: List[ClashProxyBriefResponse]

class ClashProxyResponse(ClashProxy):
    id: int
    class Config:
        orm_mode = True

class ClashProxiesResponse(BaseModel):
    data: List[ClashProxyResponse]
    total: int

class ClashProxyGroup(BaseModel):
    name: str
    tag: str
    type: str
    builtin: bool
    proxies: str
    settings: dict

    @validator('name', check_fields=False)
    def validate_name(cls, v):
        if not PROXY_NAME_REGEXP.match(v):
            raise value_error('InvalidProxyName', 'name not accept quotes')
        return v
    
    @validator('tag', check_fields=False)
    def validate_tag(cls, v):
        if not PROXY_TAG_REGEXP.match(v):
            raise value_error('InvalidProxyTag', 'tag only accept "A-Za-z0-9_:-.@#"')
        return v
    
    @validator('proxies', check_fields=False)
    def validate_proxies(cls, v: str):
        if not PROXY_GROUP_PROXIES_REGEXP.match(v):
            if not v or v.count() == 0:
                raise value_error('NoProxy', 'no proxies selected')
            else:
                raise ValueError('proxies only accept "0-9,"')
        return v

class ClashProxyGroupCreate(ClashProxyGroup):
    pass

class ClashProxyGroupResponse(ClashProxyGroup):
    id: int
    class Config:
        orm_mode = True

class ClashProxyGroupsResponse(BaseModel):
    data: List[ClashProxyGroupResponse]
    total: int

class ClashProxyTagResponse(BaseModel):
    tag: str
    servers: List[str]

class ClashProxyTagsResponse(BaseModel):
    data: List[ClashProxyTagResponse]

class ClashProxyInboundResponse(BaseModel):
    name: str
    type: str
    server: str
    security: str
    network: str
    port: str
    servername: str

class ClashProxyInboundsResponse(BaseModel):
    data: List[ClashProxyInboundResponse]

class ClashRule(BaseModel):
    type: str
    content: str
    option: str
    policy: str
    ruleset: str
    priority: int

    @validator('content', check_fields=False)
    def validate_content(cls, v):
        if not RULE_CONTENT_REGEXP.match(v):
            raise value_error('InvalidRuleContent', 'content only accept "A-Za-z0-9_-/.:,()"')
        return v
    
class ClashRuleCreate(ClashRule):
    ruleset_id: Optional[int] = 0

class ClashRuleResponse(ClashRule):
    id: int
    class Config:
        orm_mode = True

    @validator('ruleset', pre=True, check_fields=False)
    def validate_ruleset(cls, v):
        return v.name

class ClashRulesResponse(BaseModel):
    data: List[ClashRuleResponse]
    total: int

class ClashRuleset(BaseModel):
    name: str
    builtin: bool
    policy: str
    settings: dict

    @validator('name', check_fields=False)
    def validate_name(cls, v):
        if not RULESET_NAME_REGEXP.match(v):
            raise value_error('InvalidRulesetName', 'name only accept "a-zA-Z0-9_"')
        return v

class ClashRulesetCreate(ClashRuleset):
    pass

class ClashRulesetResponse(ClashRuleset):
    id: int
    class Config:
        orm_mode = True

class ClashRulesetsResponse(BaseModel):
    data: List[ClashRulesetResponse]
    
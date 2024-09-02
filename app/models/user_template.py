from typing import Dict, List, Optional, Union

from pydantic import BaseModel, Field, validator

from app import xray
from app.models.proxy import ProxyTypes


class UserTemplate(BaseModel):
    name: Optional[str] = Field(None, nullable=True)
    data_limit: Optional[int] = Field(
        ge=0, default=None, description="data_limit can be 0 or greater"
    )
    expire_duration: Optional[int] = Field(
        ge=0, default=None, description="expire_duration can be 0 or greater in seconds"
    )
    username_prefix: Optional[str] = Field(max_length=20, min_length=1, default=None)
    username_suffix: Optional[str] = Field(max_length=20, min_length=1, default=None)

    inbounds: Dict[ProxyTypes, List[str]] = {}


class UserTemplateCreate(UserTemplate):
    class Config:
        schema_extra = {
            "example": {
                "name": "my template 1",
                "inbounds": {"vmess": ["VMESS_INBOUND"], "vless": ["VLESS_INBOUND"]},
                "data_limit": 0,
                "expire_duration": 0,
            }
        }


class UserTemplateModify(UserTemplate):
    class Config:
        schema_extra = {
            "example": {
                "name": "my template 1",
                "inbounds": {"vmess": ["VMESS_INBOUND"], "vless": ["VLESS_INBOUND"]},
                "data_limit": 0,
                "expire_duration": 0,
            }
        }


class UserTemplateResponse(UserTemplate):
    id: int

    @validator("inbounds", pre=True)
    def validate_inbounds(cls, v):
        final = {}
        inbound_tags = [i.tag for i in v]
        for protocol, inbounds in xray.config.inbounds_by_protocol.items():
            for inbound in inbounds:
                if inbound["tag"] in inbound_tags:
                    if protocol in final:
                        final[protocol].append(inbound["tag"])
                    else:
                        final[protocol] = [inbound["tag"]]
        return final

    class Config:
        orm_mode = True

from datetime import datetime
from typing import Dict, List, Optional

from pydantic import BaseModel, Field


class NginxStatus(BaseModel):
    enabled: bool
    running: bool
    version: Optional[str] = None
    # None when nginx could not be asked at all.
    config_ok: Optional[bool] = None
    # Whatever `nginx -t` said, passing or failing. Shown verbatim.
    message: Optional[str] = None
    listening: List[int] = []
    binary: Optional[str] = None
    paths: Dict[str, str] = {}


class NginxSite(BaseModel):
    name: str
    enabled: bool
    size: int
    modified_at: datetime


class NginxSiteContent(BaseModel):
    name: str
    enabled: bool
    content: str


class NginxSiteWrite(BaseModel):
    content: str = Field(max_length=512_000)


class NginxAsset(BaseModel):
    """One file under the web root."""

    path: str
    size: int
    modified_at: datetime


class NginxAssetContent(BaseModel):
    path: str
    content: str


class NginxAssetWrite(BaseModel):
    path: str = Field(min_length=1, max_length=256)
    content: str = Field(max_length=512_000)


class NginxWebroot(BaseModel):
    root: str
    total_bytes: int
    assets: List[NginxAsset]


class NginxLog(BaseModel):
    name: str
    path: str
    lines: int
    content: str


class NginxResult(BaseModel):
    """What nginx said about the change. `detail` is its own output."""

    detail: str
    status: NginxStatus

from datetime import datetime
from typing import List, Optional

from pydantic import BaseModel, Field


class CertificateResponse(BaseModel):
    name: str
    domains: List[str]
    expires_at: Optional[datetime] = None
    days_left: Optional[int] = None
    certificate_path: Optional[str] = None
    private_key_path: Optional[str] = None


class CertificateList(BaseModel):
    """The certificates certbot knows about, plus how the panel is configured."""
    enabled: bool
    staging: bool
    certificates: List[CertificateResponse]


class CertificateCreate(BaseModel):
    domains: List[str] = Field(min_length=1)
    email: Optional[str] = None
    # http-01 only: standalone binds port 80 itself, webroot writes the
    # challenge into a directory another server already serves.
    method: str = "standalone"
    webroot: Optional[str] = None

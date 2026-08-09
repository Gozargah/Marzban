from datetime import datetime
from typing import Any, Dict, List, Optional

from pydantic import BaseModel, ConfigDict


class AuditLogResponse(BaseModel):
    id: int
    created_at: datetime
    admin_username: Optional[str] = None
    action: str
    target_type: Optional[str] = None
    target_name: Optional[str] = None
    method: Optional[str] = None
    path: Optional[str] = None
    status_code: Optional[int] = None
    ip: Optional[str] = None
    user_agent: Optional[str] = None
    details: Optional[Dict[str, Any]] = None

    model_config = ConfigDict(from_attributes=True)


class AuditLogsResponse(BaseModel):
    logs: List[AuditLogResponse]
    total: int


class AuditMetaResponse(BaseModel):
    admins: List[str]
    actions: List[str]

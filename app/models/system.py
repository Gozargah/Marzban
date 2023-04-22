from pydantic import BaseModel


class SystemStats(BaseModel):
    version: str
    mem_total: int
    mem_used: int
    total_user: int
    users_active: int
    incoming_bandwidth: int
    outgoing_bandwidth: int

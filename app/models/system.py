from pydantic import BaseModel


class SystemStats(BaseModel):
    mem_total: int
    mem_used: int
    total_user: int
    users_active: int
    incoming_bandwidth: int
    outgoing_bandwith: int

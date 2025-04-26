from pydantic import BaseModel


class SystemStats(BaseModel):
    version: str
    mem_total: int
    mem_used: int
    cpu_cores: int
    cpu_usage: float
    total_user: int
    online_users: int
    active_users: int
    on_hold_users: int
    disabled_users: int
    expired_users: int
    limited_users: int
    incoming_bandwidth: int
    outgoing_bandwidth: int

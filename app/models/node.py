from decimal import ROUND_HALF_UP, Decimal, InvalidOperation
from enum import Enum
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator

# Как Grafana unit `bytes` / VPN Nodes / панель хостера: 1 ТБ = 2^40 байт (TiB).
IEC_TB_BYTES = 1024**4


def hosting_tb_to_bytes(raw: str | float | int | Decimal | None) -> int | None:
    """Переводит ТБ из формы (0.7 / '0,7' / '') в IEC-байты (TiB). Пустое → None."""
    if raw is None:
        return None
    if isinstance(raw, str):
        text = raw.strip().replace(",", ".")
        if not text:
            return None
        raw = text
    try:
        tb = Decimal(str(raw))
    except (InvalidOperation, ValueError):
        raise ValueError("hosting traffic limit must be a number in TB") from None
    if tb <= 0:
        raise ValueError("hosting traffic limit must be positive")
    return int((tb * IEC_TB_BYTES).to_integral_value(rounding=ROUND_HALF_UP))


class NodeStatus(str, Enum):
    connected = "connected"
    connecting = "connecting"
    error = "error"
    disabled = "disabled"


class NodeProtocol(str, Enum):
    rest = "rest"
    rpyc = "rpyc"


class NodeRole(str, Enum):
    entry = "entry"
    exit = "exit"
    direct = "direct"


class NodeBalancerStrategy(str, Enum):
    random = "random"
    round_robin = "roundRobin"
    least_ping = "leastPing"
    least_load = "leastLoad"


class NodeSettings(BaseModel):
    min_node_version: str = "v0.2.0"
    certificate: str


class CascadeRouteModel(BaseModel):
    exit_node_id: int
    entry_inbound_tag: str
    cascade_inbound_tag: str
    model_config = ConfigDict(from_attributes=True)


class Node(BaseModel):
    name: str
    address: str
    port: int = 62050
    api_port: int = 62051
    protocol: NodeProtocol = NodeProtocol.rest
    usage_coefficient: float = Field(gt=0, default=1.0)
    inbounds: list[str] | None = None
    role: NodeRole = NodeRole.direct
    cascade_routes: list[CascadeRouteModel] | None = None
    is_bs: bool = False
    cascade_balancer_strategy: NodeBalancerStrategy = NodeBalancerStrategy.random
    hosting_traffic_limit_bytes: int | None = None
    # Чей это сервер (NPVPN-2044). NULL — нода наша. См. комментарий у
    # Node.owner_bot_id в app/db/models.py — is_bs остаётся только про лимит.
    owner_bot_id: int | None = None

    @field_validator("hosting_traffic_limit_bytes")
    @classmethod
    def _positive_hosting_limit(cls, v):
        if v is None:
            return None
        if v <= 0:
            raise ValueError("hosting_traffic_limit_bytes must be positive")
        return v


class NodeCreate(Node):
    add_as_new_host: bool = True
    model_config = ConfigDict(
        json_schema_extra={
            "example": {
                "name": "DE node",
                "address": "192.168.1.1",
                "port": 62050,
                "api_port": 62051,
                "protocol": "rest",
                "add_as_new_host": True,
                "usage_coefficient": 1,
            }
        }
    )


class NodeModify(Node):
    name: str | None = Field(None, nullable=True)
    address: str | None = Field(None, nullable=True)
    port: int | None = Field(None, nullable=True)
    api_port: int | None = Field(None, nullable=True)
    protocol: NodeProtocol | None = Field(None, nullable=True)
    status: NodeStatus | None = Field(None, nullable=True)
    usage_coefficient: float | None = Field(None, nullable=True)
    inbounds: list[str] | None = Field(None, nullable=True)
    role: NodeRole | None = Field(None, nullable=True)
    cascade_routes: list[CascadeRouteModel] | None = Field(None, nullable=True)
    is_bs: bool | None = Field(None, nullable=True)
    cascade_balancer_strategy: NodeBalancerStrategy | None = Field(None, nullable=True)
    model_config = ConfigDict(
        json_schema_extra={
            "example": {
                "name": "DE node",
                "address": "192.168.1.1",
                "port": 62050,
                "api_port": 62051,
                "protocol": "rest",
                "status": "disabled",
                "usage_coefficient": 1.0,
            }
        }
    )


class NodeResponse(Node):
    id: int
    xray_version: str | None = None
    status: NodeStatus
    message: str | None = None
    inbounds: list[str] = []
    role: NodeRole = NodeRole.direct
    cascade_routes: list[CascadeRouteModel] = []
    is_bs: bool = False
    cascade_balancer_strategy: NodeBalancerStrategy = NodeBalancerStrategy.random
    model_config = ConfigDict(from_attributes=True)

    @field_validator("inbounds", mode="before")
    @classmethod
    def _inbounds_to_tags(cls, v):
        if not v:
            return []
        if isinstance(v[0], str):
            return v
        return [i.tag for i in v]


class NodeUsageResponse(BaseModel):
    node_id: int | None = None
    node_name: str
    uplink: int
    downlink: int


class NodesUsageResponse(BaseModel):
    usages: list[NodeUsageResponse]
    # nic — суточные NIC / MTD hosting_used_bytes; panel — node_usages (Xray)
    traffic_source: Literal["nic", "panel"] = "panel"

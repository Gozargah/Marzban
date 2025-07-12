import re
from enum import Enum
from ipaddress import ip_address
from uuid import UUID

from cryptography.x509 import load_pem_x509_certificate
from pydantic import BaseModel, ConfigDict, Field, field_validator

from app.db.models import NodeConnectionType, NodeStatus

# Basic PEM format validation
CERT_PATTERN = r"-----BEGIN CERTIFICATE-----(.*?)-----END CERTIFICATE-----"
KEY_PATTERN = r"-----BEGIN (?:RSA )?PRIVATE KEY-----"


class UsageTable(str, Enum):
    node_user_usages = "node_user_usages"
    node_usages = "node_usages"


class NodeSettings(BaseModel):
    min_node_version: str = "v1.0.0"


class Node(BaseModel):
    name: str
    address: str
    port: int = 62050
    usage_coefficient: float = Field(gt=0, default=1.0)
    connection_type: NodeConnectionType
    server_ca: str
    keep_alive: int
    max_logs: int = Field(gt=0, default=1000)
    core_config_id: int
    api_key: str
    gather_logs: bool = Field(default=True)


class NodeCreate(Node):
    model_config = ConfigDict(
        json_schema_extra={
            "example": {
                "name": "DE node",
                "address": "192.168.1.1",
                "port": 62050,
                "usage_coefficient": 1,
                "server_ca": "-----BEGIN CERTIFICATE-----\n...\n-----END CERTIFICATE-----",
                "connection_type": "grpc",
                "keep_alive": 60,
                "max_logs": 1000,
                "core_config_id": 1,
                "api_key": "valid uuid",
                "gather_logs": True,
            }
        }
    )

    @field_validator("address")
    @classmethod
    def validate_address(cls, v: str) -> str:
        if not v:
            return v
        try:
            ip_address(v)
            return v
        except ValueError:
            # Regex for domain validation
            if re.match(r"^(?:[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?\.)+[a-zA-Z]{2,6}$", v):
                return v
            raise ValueError("Invalid address format, must be a valid IPv4/IPv6 or domain")

    @field_validator("port")
    @classmethod
    def validate_port(cls, v: int) -> int:
        if not v:
            return v
        if not 1 <= v <= 65535:
            raise ValueError("Port must be between 1 and 65535")
        return v

    @field_validator("server_ca")
    @classmethod
    def validate_certificate(cls, v: str | None) -> str | None:
        if v is None:
            return None

        v = v.strip()

        # Check for PEM certificate format
        if not re.search(CERT_PATTERN, v, re.DOTALL):
            raise ValueError("Invalid certificate format - must contain PEM certificate blocks")

        # Check for private key material
        if re.search(KEY_PATTERN, v):
            raise ValueError("Certificate contains private key material")

        if len(v) > 2048:
            raise ValueError("Certificate too large (max 2048 characters)")

        try:
            load_pem_x509_certificate(v.encode("utf-8"))
            pass
        except Exception:
            raise ValueError("Invalid certificate structure")

        return v

    @field_validator("api_key", mode="before")
    @classmethod
    def validate_api_key(cls, v) -> str:
        if not v:
            return
        try:
            UUID(v)
        except ValueError:
            raise ValueError("Invalid UUID format for api_key")
        return v


class NodeModify(NodeCreate):
    name: str | None = Field(default=None)
    address: str | None = Field(default=None)
    port: int | None = Field(default=None)
    api_port: int | None = Field(default=None)
    status: NodeStatus | None = Field(default=None)
    usage_coefficient: float | None = Field(default=None)
    server_ca: str | None = Field(default=None)
    connection_type: NodeConnectionType | None = Field(default=None)
    keep_alive: int | None = Field(default=None)
    max_logs: int | None = Field(default=None)
    core_config_id: int | None = Field(default=None)
    api_key: str | None = Field(default=None)
    gather_logs: bool | None = Field(default=None)

    model_config = ConfigDict(
        json_schema_extra={
            "example": {
                "name": "DE node",
                "address": "192.168.1.1",
                "port": 62050,
                "status": "disabled",
                "usage_coefficient": 1.0,
                "connection_type": "grpc",
                "server_ca": "-----BEGIN CERTIFICATE-----\n...\n-----END CERTIFICATE-----",
                "keep_alive": 60,
                "max_logs": 1000,
                "core_config_id": 1,
                "api_key": "valid uuid",
                "gather_logs": True,
            }
        }
    )


class NodeResponse(Node):
    id: int
    api_key: str | None
    core_config_id: int | None
    xray_version: str | None
    node_version: str | None
    status: NodeStatus
    message: str | None

    model_config = ConfigDict(from_attributes=True)

from cryptography import x509
from cryptography.hazmat.backends import default_backend
from pydantic import BaseModel, validator
from enum import Enum
from typing import Union, List


class NodeStatus(str, Enum):
    connected = "connected"
    connecting = "connecting"
    error = "error"
    disabled = "disabled"


class Node(BaseModel):
    name: str
    address: str
    port: int = 62050
    api_port: int = 62051
    certificate: str

    @validator('certificate', pre=True, always=True)
    def validate_certificate(cls, v):
        if v is None:
            return v

        v = v.strip()
        try:
            x509.load_pem_x509_certificate(data=v.encode(), backend=default_backend())
        except ValueError:
            raise ValueError('certificate is not valid')

        return v


class NodeCreate(Node):
    add_as_new_host: bool = True

    class Config:
        schema_extra = {
            "example": {
                "name": "DE node",
                "address": "192.168.1.1",
                "port": 62050,
                "api_port": 62051,
                "add_as_new_host": True,
                "certificate": "-----BEGIN CERTIFICATE-----\nMIIEnDCCAoQCAQAwDQYJKoZIhvcNAQENBQAwEzERMA8GA1UEAwwIR296YXJnYWgw\nIBcNMjMwMjE5MjMwOTMyWhgPMjEyMzAxMjYyMzA5MzJaMBMxETAPBgNVBAMMCEdv\nemFyZ2FoMIICIjANBgkqhkiG9w0BAQEFAAOCAg8AMIICCgKCAgEA0BvDh0eU78EJ\n+xzBWUjjMrWf/0rWV5fDl7b4RU8AjeviG1RmEc64ueZ3s6q1LI6DJX1+qGuqDEvp\nmRc09HihO07DyQgQqF38/E4CXshZ2L3UOzsa80lf74dhEqAR/EJQXXMwGSb3T9J9\nseCqCyiEn/JLEGsilDz64cTv8MXMAcjjpdefkFyQP+4hAKQgHbtfJ9KPSu4/lkZR\n/orsjoWGJv4LS0MsXV1t7LB/bNC7qOzlmzrfTMH4EmtmKH8HwhMkL1nUG+vXEfwm\nQg3Ly+yrwKNw9+L7DxbKnoy2Zqp9dN+rzKDgcpHsoIYf0feInUHHlRUu303kAFQN\nGlnzZgD8ulHI1sQLNS3teYpj817G3EXKOhu56MvBehBR9GfvfS1D5D/QvwRfcaZI\nCULBPoGqovhrknbUXt9TEfzc9YnfSzlcJYcH54/aUBVJNs74EK38OQ+JciLnw4qe\ngbXEshaeLgGM3bhXwUhctcmZf5ASWDsAVtEeCXGNK+ua6wlFXKVd0jOt2ZZYG42X\nwrpHCErAWY7AoxHmXlfPcPM0Uu7FuEBP27f8U3N+glG1lWrogNn54j1ZrzQVUVVv\ngog78DrjjzrR0puQ9x9q6FvEUTAaaA06lvi2/6BuwO0jKrHQCP7fFUmRXg5B5lrJ\n9czSDHT9WH9Sc1qdxQTevhc9C/h6MuMCAwEAATANBgkqhkiG9w0BAQ0FAAOCAgEA\nI7aXhLejp53NyuwzmdfeycY373TI4sD3WfPdEB6+FSCX38YghyQl8tkeaHPgPKY5\n+vA+eVxE7E961UNPtJtJg/dzBvoWUroTnpvKjVdDImFaZa/PvUMgSEe8tC3FtB6i\nAp7f0yYOGsFf6oaOxMfs/F0sGflsaVWuiATTsV8Er+uzge77Q8AXzy6spuXg3ALF\n56tqzZY5x/04g1KUQB4JN+7JzipnfSIUof0eAKf9gQbumUU+Q2b32HMC2MOlUjv+\nIl8rJ9cs0zwC1BOmqoS3Ez22dgtT7FucvIJ1MGP8oUAudMmrXDxx/d7CmnD5q1v4\nXFSa6Zv8LPLCz5iMbo0FjNlKyZo3699PtyBFXt3zyfTPmiy19RVGTziHqJ9NR9kW\nkBwvFzIy+qPc/dJAk435hVaV3pRBC7Pl2Y7k/pJxxlC07PkACXuhwtUGhQrHYWkK\niLlV21kNnWuvjS1orTwvuW3aagb6tvEEEmlMhw5a2B8sl71sQ6sxWidgRaOSGW7l\ng1gctfdLMARuV6LkLiGy5k2FGAW/tfepEyySA/N9WhcHg+rZ4/x1thP0eYJPQ2YJ\nAjimHyBb+3tFs7KaOPu9G5xgbQWUWccukMDXqybqiUDSfU/T5/+XM8CKq/Fu0DBu\n3lg0NYigkZFs99lZJ1H4BkMWgL65aybO4XwfZJTGLe0=\n-----END CERTIFICATE-----"
            }
        }


class NodeModify(Node):
    name: str = None
    address: str = None
    port: int = None
    api_port: int = None
    certificate: str = None

    class Config:
        schema_extra = {
            "example": {
                "name": "DE node",
                "address": "192.168.1.1",
                "port": 62050,
                "api_port": 62051,
                "certificate": "-----BEGIN CERTIFICATE-----\nMIIEnDCCAoQCAQAwDQYJKoZIhvcNAQENBQAwEzERMA8GA1UEAwwIR296YXJnYWgw\nIBcNMjMwMjE5MjMwOTMyWhgPMjEyMzAxMjYyMzA5MzJaMBMxETAPBgNVBAMMCEdv\nemFyZ2FoMIICIjANBgkqhkiG9w0BAQEFAAOCAg8AMIICCgKCAgEA0BvDh0eU78EJ\n+xzBWUjjMrWf/0rWV5fDl7b4RU8AjeviG1RmEc64ueZ3s6q1LI6DJX1+qGuqDEvp\nmRc09HihO07DyQgQqF38/E4CXshZ2L3UOzsa80lf74dhEqAR/EJQXXMwGSb3T9J9\nseCqCyiEn/JLEGsilDz64cTv8MXMAcjjpdefkFyQP+4hAKQgHbtfJ9KPSu4/lkZR\n/orsjoWGJv4LS0MsXV1t7LB/bNC7qOzlmzrfTMH4EmtmKH8HwhMkL1nUG+vXEfwm\nQg3Ly+yrwKNw9+L7DxbKnoy2Zqp9dN+rzKDgcpHsoIYf0feInUHHlRUu303kAFQN\nGlnzZgD8ulHI1sQLNS3teYpj817G3EXKOhu56MvBehBR9GfvfS1D5D/QvwRfcaZI\nCULBPoGqovhrknbUXt9TEfzc9YnfSzlcJYcH54/aUBVJNs74EK38OQ+JciLnw4qe\ngbXEshaeLgGM3bhXwUhctcmZf5ASWDsAVtEeCXGNK+ua6wlFXKVd0jOt2ZZYG42X\nwrpHCErAWY7AoxHmXlfPcPM0Uu7FuEBP27f8U3N+glG1lWrogNn54j1ZrzQVUVVv\ngog78DrjjzrR0puQ9x9q6FvEUTAaaA06lvi2/6BuwO0jKrHQCP7fFUmRXg5B5lrJ\n9czSDHT9WH9Sc1qdxQTevhc9C/h6MuMCAwEAATANBgkqhkiG9w0BAQ0FAAOCAgEA\nI7aXhLejp53NyuwzmdfeycY373TI4sD3WfPdEB6+FSCX38YghyQl8tkeaHPgPKY5\n+vA+eVxE7E961UNPtJtJg/dzBvoWUroTnpvKjVdDImFaZa/PvUMgSEe8tC3FtB6i\nAp7f0yYOGsFf6oaOxMfs/F0sGflsaVWuiATTsV8Er+uzge77Q8AXzy6spuXg3ALF\n56tqzZY5x/04g1KUQB4JN+7JzipnfSIUof0eAKf9gQbumUU+Q2b32HMC2MOlUjv+\nIl8rJ9cs0zwC1BOmqoS3Ez22dgtT7FucvIJ1MGP8oUAudMmrXDxx/d7CmnD5q1v4\nXFSa6Zv8LPLCz5iMbo0FjNlKyZo3699PtyBFXt3zyfTPmiy19RVGTziHqJ9NR9kW\nkBwvFzIy+qPc/dJAk435hVaV3pRBC7Pl2Y7k/pJxxlC07PkACXuhwtUGhQrHYWkK\niLlV21kNnWuvjS1orTwvuW3aagb6tvEEEmlMhw5a2B8sl71sQ6sxWidgRaOSGW7l\ng1gctfdLMARuV6LkLiGy5k2FGAW/tfepEyySA/N9WhcHg+rZ4/x1thP0eYJPQ2YJ\nAjimHyBb+3tFs7KaOPu9G5xgbQWUWccukMDXqybqiUDSfU/T5/+XM8CKq/Fu0DBu\n3lg0NYigkZFs99lZJ1H4BkMWgL65aybO4XwfZJTGLe0=\n-----END CERTIFICATE-----"
            }
        }


class NodeResponse(Node):
    id: int
    xray_version: Union[str, None]
    status: NodeStatus
    message: Union[str, None]

    class Config:
        orm_mode = True


class NodeUsageResponse(BaseModel):
    node_id: Union[int, None]
    node_name: str
    uplink: int
    downlink: int


class NodesUsageResponse(BaseModel):
    usages: List[NodeUsageResponse]

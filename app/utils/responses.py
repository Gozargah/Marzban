"""Documented Error responses for API routes"""

from pydantic import BaseModel


class HTTPException(BaseModel):
    detail: str


class Unauthorized(HTTPException):
    detail: str = "Not authenticated"


class Forbidden(HTTPException):
    detail: str = "You are not allowed to ..."


class NotFound(HTTPException):
    detail: str = "Entity {} not found"


class Conflict(HTTPException):
    detail: str = "Entity already exists"


_400 = {"description": "Bad request", "model": HTTPException}

_401 = {
    "description": "Unauthorized",
    "model": Unauthorized,
    "headers": {
        "WWW-Authenticate": {
            "description": "Authentication type",
            "schema": {
                "type": "string"
            },
        },
    },
}

_403 = {"description": "Forbidden", "model": Forbidden}

_404 = {"description": "Not found", "model": NotFound}

_409 = {"description": "Conflict", "model": Conflict}

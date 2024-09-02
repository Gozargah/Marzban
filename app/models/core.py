from pydantic import BaseModel


class CoreStats(BaseModel):
    version: str
    started: bool
    logs_websocket: str

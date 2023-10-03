from pydantic import BaseModel


class CoreStats(BaseModel):
    version: str
    started: bool
    logs_websocket: str

class FlowResponse(BaseModel):
    flow: str

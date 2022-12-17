from app import app

from .admin import *
from .system import *
from .user import *


@app.get("/", status_code=204)
def base():
    return

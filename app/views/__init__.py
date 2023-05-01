from app import app

from .admin import *
from .subscription import *
from .system import *
from .core import *
from .user import *
from .user_template import *
from .node import *


@app.get("/", status_code=204)
def base():
    return

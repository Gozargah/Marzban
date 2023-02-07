from app import app
from fastapi.staticfiles import StaticFiles

from .admin import *
from .system import *
from .user import *
from .subscription import *

app.mount("/", StaticFiles(directory="/home", html=True), name="home")
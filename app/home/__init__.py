from pathlib import Path

from app import app
from fastapi.staticfiles import StaticFiles

path = "/"
base_dir = Path(__file__).parent


def run():
    app.mount(path, StaticFiles(directory=base_dir, html=True), name="home")


@app.on_event("startup")
def startup():
    run()

import atexit
import os
import subprocess
from pathlib import Path

from fastapi.staticfiles import StaticFiles

from app import app, on_startup
from config import DASHBOARD_PATH, DEBUG, UVICORN_PORT, VITE_BASE_API

base_dir = Path(__file__).parent
build_dir = base_dir / "build"
statics_dir = build_dir / "statics"


def build_api_interface():
    subprocess.Popen(
        ["bun", "run", "wait-port-gen-api"],
        env={**os.environ, "UVICORN_PORT": str(UVICORN_PORT)},
        cwd=base_dir,
        stdout=subprocess.DEVNULL,
    )


def build():
    proc = subprocess.Popen(
        ["bun", "run", "build", "--outDir", build_dir, "--assetsDir", "statics"],
        env={**os.environ, "VITE_BASE_API": VITE_BASE_API},
        cwd=base_dir,
    )
    proc.wait()
    with open(build_dir / "index.html", "r") as file:
        html = file.read()
    with open(build_dir / "404.html", "w") as file:
        file.write(html)


def run_dev():
    build_api_interface()
    proc = subprocess.Popen(
        ["bun", "run", "dev", "--base", os.path.join(DASHBOARD_PATH, "")],
        env={**os.environ, "VITE_BASE_API": VITE_BASE_API, "DEBUG": "false"},
        cwd=base_dir,
    )

    atexit.register(proc.terminate)


def run_build():
    if not build_dir.is_dir():
        build()

    app.mount(DASHBOARD_PATH, StaticFiles(directory=build_dir, html=True), name="dashboard")
    app.mount("/statics/", StaticFiles(directory=statics_dir, html=True), name="statics")


@on_startup
def run_dashboard():
    if DEBUG:
        run_dev()
    else:
        run_build()

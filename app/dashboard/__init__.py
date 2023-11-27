import atexit
import os
import subprocess
from pathlib import Path
from config import (
    UVICORN_PORT
)
from app import app
from config import DEBUG, VITE_BASE_API
from fastapi.staticfiles import StaticFiles
from app import settings


base_dir = Path(__file__).parent
build_dir = base_dir / 'build'
statics_dir = build_dir / 'statics'


def build_api_interface():
    proc = subprocess.Popen(
        ['npm', 'run', 'wait-port-gen-api'],
        env={**os.environ, 'UVICORN_PORT': str(UVICORN_PORT)},
        cwd=base_dir,
        stdout=subprocess.DEVNULL
    )


def build():
    proc = subprocess.Popen(
        ['npm', 'run', 'build', '--',  '--outDir', build_dir, '--assetsDir', 'statics'],
        env={**os.environ, 'VITE_BASE_API': VITE_BASE_API},
        cwd=base_dir
    )
    proc.wait()
    with open(build_dir / 'index.html', 'r') as file:
        html = file.read()
    with open(build_dir / '404.html', 'w') as file:
        file.write(html)


def run_dev():
    build_api_interface()
    proc = subprocess.Popen(
        ['npm', 'run', 'dev', '--', '--host', '0.0.0.0', '--clearScreen', 'false'],
        env={**os.environ, 'VITE_BASE_API': VITE_BASE_API},
        cwd=base_dir
    )

    atexit.register(proc.terminate)


def run_build():
    if not build_dir.is_dir():
        build()

    app.mount(
        settings.get("dashboard_path", '/dashboard'),
        StaticFiles(directory=build_dir, html=True),
        name="dashboard"
    )
    app.mount(
        '/statics/',
        StaticFiles(directory=statics_dir, html=True),
        name="statics"
    )


@app.on_event("startup")
def startup():
    if DEBUG is True:
        run_dev()
    else:
        run_build()

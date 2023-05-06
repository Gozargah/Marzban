import atexit
import os
import subprocess
from pathlib import Path

from app import app
from config import DEBUG, VITE_BASE_API
from fastapi.staticfiles import StaticFiles

path = '/dashboard/'
base_dir = Path(__file__).parent
build_dir = base_dir / 'build'


def build():
    proc = subprocess.Popen(
        ['npm', 'run', 'build', '--', '--base', path,  '--outDir', build_dir],
        env={**os.environ, 'VITE_BASE_API': VITE_BASE_API},
        cwd=base_dir
    )
    proc.wait()
    with open(build_dir / 'index.html', 'r') as file:
        html = file.read()
    with open(build_dir / '404.html', 'w') as file:
        file.write(html)


def run_dev():
    proc = subprocess.Popen(
        ['npm', 'run', 'dev', '--', '--host', '0.0.0.0', '--base', path, '--clearScreen', 'false'],
        env={**os.environ, 'VITE_BASE_API': VITE_BASE_API},
        cwd=base_dir
    )

    atexit.register(proc.terminate)


def run_build():
    if not build_dir.is_dir():
        build()

    app.mount(
        path,
        StaticFiles(directory=build_dir, html=True),
        name="dashboard"
    )


@app.on_event("startup")
def startup():
    if DEBUG is True:
        run_dev()
    else:
        run_build()

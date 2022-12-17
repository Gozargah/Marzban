import subprocess
from app import app
from fastapi.staticfiles import StaticFiles
from pathlib import Path

path = '/dashboard'
dist = Path(__file__).parent / 'frontend/dist'


def build(base):
    proc = subprocess.Popen(['yarn', 'build', '--base', base], cwd=dist.parent)
    return proc.wait()


if not dist.is_dir():
    build(path)


app.mount(path,
          StaticFiles(directory=dist, html=True),
          name="dashboard")

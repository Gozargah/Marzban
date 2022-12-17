import subprocess
from app import app
from fastapi.staticfiles import StaticFiles
from pathlib import Path

path = '/dashboard'
files = Path(__file__).parent / 'frontend/static'


def build(base):
    proc = subprocess.Popen(['yarn', 'build', '--base', base,  '--outDir', files], cwd=files.parent)
    return proc.wait()


if not files.is_dir():
    build(path)


app.mount(path,
          StaticFiles(directory=files, html=True),
          name="dashboard")

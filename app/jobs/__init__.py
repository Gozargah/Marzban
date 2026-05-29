"""Job auto-loader.

Importing this package side-effect-imports every non-underscore-prefixed
module in this directory so their module-level `scheduler.add_job(...)`
calls run. Uses `importlib.import_module` instead of
`spec_from_file_location` so the loaded modules are registered under
their normal dotted names in `sys.modules` (the previous loader did
not, which prevented other modules from doing
`from app.jobs.xray_core import start_core`).

Registration ORDER no longer matters as of v0.9.0 Task 3 — the
`@app.on_event` handlers in `xray_core.py` and `send_notifications.py`
have been moved into the lifespan in `app/__init__.py`, which controls
ordering explicitly. The `0_` filename prefix that used to force
xray_core first is no longer needed; the file was renamed to
`xray_core.py`. The sorted iteration here is purely for deterministic
debug output.
"""

import glob
import importlib
from os.path import basename, dirname, join

for file in sorted(glob.glob(join(dirname(__file__), "*.py"))):
    name = basename(file).replace('.py', '')
    if name.startswith('_'):
        continue
    importlib.import_module(f"app.jobs.{name}")

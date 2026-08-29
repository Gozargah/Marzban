"""Managing the host's nginx from the panel.

The panel edits files under /etc/nginx, asks nginx to check them, and signals
the running master to reload. That last part only reaches the host's nginx when
the container shares the host's PID namespace and /var/run — see the Nginx
section of docs/INSTALL.md. Off until NGINX_ENABLED is set.

Two things carry the weight here. Every name that reaches the filesystem is
matched against a strict pattern rather than merely cleaned, and every path is
resolved and checked to be inside the directory it belongs to, so a name like
`../../etc/passwd` cannot be written through an upload or read back through a
download. A config is always checked with `nginx -t` before it is kept: a
broken server block that reaches a reload takes the site down, and the panel
with it.
"""

import os
import re
import shutil
import subprocess
from dataclasses import dataclass, field
from typing import List, Optional, Tuple

from app.utils.files import FileWriteError, atomic_write
from config import (NGINX_CONF_DIR, NGINX_ENABLED, NGINX_EXECUTABLE_PATH,
                    NGINX_LOG_DIR, NGINX_MAX_UPLOAD_BYTES,
                    NGINX_SITES_AVAILABLE, NGINX_SITES_ENABLED, NGINX_TIMEOUT,
                    NGINX_WEBROOT)

# A site file name: letters, digits, dots, dashes and underscores. No slashes,
# so nothing can point outside sites-available, and no leading dot.
SITE_NAME_RE = re.compile(r"^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$")

# One path segment of an uploaded file, same rules. Directories are allowed in
# an upload path, each segment checked separately.
SEGMENT_RE = re.compile(r"^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$")

# What a static site is made of. Anything that nginx would execute, or that a
# browser would treat as a document from another origin, is not on the list.
ALLOWED_SUFFIXES = frozenset(
    {
        ".html", ".htm", ".css", ".js", ".mjs", ".json", ".txt", ".xml",
        ".png", ".jpg", ".jpeg", ".gif", ".svg", ".webp", ".avif", ".ico",
        ".woff", ".woff2", ".ttf", ".otf", ".eot", ".map", ".webmanifest",
    }
)

VERSION_RE = re.compile(r"nginx/(\S+)")

LOGS = {"access": "access.log", "error": "error.log"}


class NginxError(Exception):
    """The request could not be carried out; the message is safe to show."""


@dataclass
class Site:
    name: str
    enabled: bool
    size: int
    modified_at: float


@dataclass
class Asset:
    """One file under the web root."""

    path: str  # relative to the web root, using forward slashes
    size: int
    modified_at: float


@dataclass
class Status:
    running: bool
    version: Optional[str] = None
    config_ok: Optional[bool] = None
    message: Optional[str] = None
    listening: List[int] = field(default_factory=list)


def is_enabled() -> bool:
    return bool(NGINX_ENABLED)


def _require_enabled() -> None:
    if not is_enabled():
        raise NginxError(
            "nginx management is disabled. Set NGINX_ENABLED=true, and give the container "
            "the host's /etc/nginx and PID namespace."
        )


def _run(args: List[str]) -> subprocess.CompletedProcess:
    """Run nginx with a fixed argument list. Never through a shell."""
    try:
        return subprocess.run(
            [NGINX_EXECUTABLE_PATH, *args],
            capture_output=True,
            text=True,
            timeout=NGINX_TIMEOUT,
            check=False,
        )
    except FileNotFoundError:
        raise NginxError(f"nginx was not found at {NGINX_EXECUTABLE_PATH}.")
    except subprocess.TimeoutExpired:
        raise NginxError(f"nginx did not finish within {NGINX_TIMEOUT} seconds.")
    except PermissionError:
        raise NginxError("The panel is not allowed to run nginx. It needs root privileges.")


# --- status ------------------------------------------------------------------


def version() -> Optional[str]:
    result = _run(["-v"])
    # nginx prints its banner on stderr.
    match = VERSION_RE.search(result.stderr or result.stdout or "")
    return match.group(1) if match else None


def is_running() -> bool:
    """Whether a master process is around to be signalled.

    Read from the pid file rather than by scanning processes: with the host's
    PID namespace shared, checking that the pid is alive is the same question
    the reload will ask.
    """
    for candidate in ("/run/nginx.pid", "/var/run/nginx.pid"):
        try:
            with open(candidate, "r") as handle:
                pid = int(handle.read().strip())
        except (OSError, ValueError):
            continue
        try:
            os.kill(pid, 0)
        except PermissionError:
            # The process is there, it just is not ours to signal.
            return True
        except OSError:
            # Gone, or a stale pid file. Try the other location.
            continue
        return True
    return False


def listening_ports() -> List[int]:
    """Ports the configuration asks nginx to listen on.

    Parsed out of the dumped config rather than out of the kernel: the panel
    reports what nginx was told to do, and the two differing is exactly what a
    pending reload looks like.
    """
    result = _run(["-T"])
    if result.returncode != 0:
        return []

    ports = set()
    for line in (result.stdout or "").splitlines():
        line = line.strip()
        if not line.startswith("listen "):
            continue
        token = line[len("listen "):].split(";")[0].split()[0]
        port = token.rsplit(":", 1)[-1].strip("[]")
        if port.isdigit():
            ports.add(int(port))
    return sorted(ports)


def check_config() -> Tuple[bool, str]:
    """Run `nginx -t`, returning whether it passed and what it said."""
    result = _run(["-t"])
    message = (result.stderr or result.stdout or "").strip()
    return result.returncode == 0, message


def status() -> Status:
    if not is_enabled():
        return Status(running=False, message="nginx management is disabled.")

    try:
        ok, message = check_config()
        return Status(
            running=is_running(),
            version=version(),
            config_ok=ok,
            message=message,
            listening=listening_ports() if ok else [],
        )
    except NginxError as err:
        return Status(running=False, message=str(err))


def reload() -> str:
    """Reload nginx, refusing to do so while the configuration is broken.

    Checking first is the whole point: `nginx -s reload` on a bad config leaves
    the old workers running but reports success, so an admin would be told the
    change was applied when it was not.
    """
    _require_enabled()

    ok, message = check_config()
    if not ok:
        raise NginxError(f"The configuration is not valid, so nothing was reloaded:\n{message}")

    result = _run(["-s", "reload"])
    if result.returncode != 0:
        raise NginxError((result.stderr or result.stdout or "nginx could not reload.").strip()[:400])

    return message


# --- sites -------------------------------------------------------------------


def validate_site_name(name: str) -> str:
    name = (name or "").strip()
    if not SITE_NAME_RE.match(name):
        raise NginxError(
            f"{name!r} is not a valid site name. Use letters, digits, dots, dashes and underscores."
        )
    return name


def _available_path(name: str) -> str:
    return os.path.join(NGINX_SITES_AVAILABLE, validate_site_name(name))


def _enabled_path(name: str) -> str:
    return os.path.join(NGINX_SITES_ENABLED, validate_site_name(name))


def list_sites() -> List[Site]:
    _require_enabled()

    try:
        names = sorted(
            entry for entry in os.listdir(NGINX_SITES_AVAILABLE)
            if SITE_NAME_RE.match(entry)
        )
    except FileNotFoundError:
        raise NginxError(f"{NGINX_SITES_AVAILABLE} does not exist.")
    except PermissionError:
        raise NginxError(f"{NGINX_SITES_AVAILABLE} is not readable by the panel.")

    sites = []
    for name in names:
        path = os.path.join(NGINX_SITES_AVAILABLE, name)
        if not os.path.isfile(path):
            continue
        stat = os.stat(path)
        sites.append(
            Site(
                name=name,
                enabled=os.path.lexists(_enabled_path(name)),
                size=stat.st_size,
                modified_at=stat.st_mtime,
            )
        )
    return sites


def read_site(name: str) -> str:
    _require_enabled()

    try:
        with open(_available_path(name), "r") as handle:
            return handle.read()
    except FileNotFoundError:
        raise NginxError(f"No site called {name!r}.")
    except (OSError, UnicodeDecodeError) as err:
        raise NginxError(f"Could not read {name}: {err}")


def write_site(name: str, content: str) -> str:
    """Write a site and keep it only if nginx accepts the result.

    The previous version is restored when the check fails, so a bad edit cannot
    leave the host one reload away from being down.
    """
    _require_enabled()

    path = _available_path(name)
    previous = None
    if os.path.exists(path):
        try:
            with open(path, "r") as handle:
                previous = handle.read()
        except (OSError, UnicodeDecodeError):
            previous = None

    try:
        atomic_write(path, content)
    except FileWriteError as err:
        raise NginxError(str(err))

    ok, message = check_config()
    if ok:
        return message

    # Undo. A site that is not enabled cannot break the check on its own, so
    # this only bites when the file is live — which is when it matters.
    if previous is None:
        try:
            os.unlink(path)
        except OSError:
            pass
    else:
        try:
            atomic_write(path, previous)
        except FileWriteError:
            pass

    raise NginxError(f"nginx rejected the configuration, so the change was rolled back:\n{message}")


def enable_site(name: str) -> None:
    _require_enabled()

    source = _available_path(name)
    if not os.path.isfile(source):
        raise NginxError(f"No site called {name!r}.")

    link = _enabled_path(name)
    if os.path.lexists(link):
        return

    try:
        os.symlink(source, link)
    except OSError as err:
        raise NginxError(f"Could not enable {name}: {err}")


def disable_site(name: str) -> None:
    _require_enabled()

    link = _enabled_path(name)
    if not os.path.lexists(link):
        return

    try:
        os.unlink(link)
    except OSError as err:
        raise NginxError(f"Could not disable {name}: {err}")


def remove_site(name: str) -> None:
    """Delete a site, taking its symlink with it."""
    _require_enabled()

    disable_site(name)
    try:
        os.unlink(_available_path(name))
    except FileNotFoundError:
        raise NginxError(f"No site called {name!r}.")
    except OSError as err:
        raise NginxError(f"Could not delete {name}: {err}")


# --- web root ----------------------------------------------------------------


def validate_asset_path(path: str) -> str:
    """Check one upload path, segment by segment.

    Each segment has to match on its own, which rules out `..` and absolute
    paths without relying on any later normalisation. The suffix has to be one
    the panel serves; nothing here should ever end up executable.
    """
    path = (path or "").strip().replace("\\", "/").strip("/")
    if not path:
        raise NginxError("A file name is required.")

    segments = [segment for segment in path.split("/") if segment]
    if len(segments) > 8:
        raise NginxError("That path is nested too deeply.")

    for segment in segments:
        if not SEGMENT_RE.match(segment):
            raise NginxError(f"{segment!r} is not a valid file or folder name.")

    suffix = os.path.splitext(segments[-1])[1].lower()
    if suffix not in ALLOWED_SUFFIXES:
        allowed = ", ".join(sorted(ALLOWED_SUFFIXES))
        raise NginxError(f"{suffix or 'that file type'} cannot be uploaded. Allowed: {allowed}")

    return "/".join(segments)


def _webroot_path(relative: str) -> str:
    """Resolve a validated relative path, refusing anything outside the root.

    The name is already checked, so this is the second lock: a symlink inside
    the web root pointing elsewhere would otherwise let a write land outside it.
    """
    root = os.path.realpath(NGINX_WEBROOT)
    candidate = os.path.realpath(os.path.join(root, relative))
    if candidate != root and not candidate.startswith(root + os.sep):
        raise NginxError("That path is outside the web root.")
    return candidate


def list_assets() -> List[Asset]:
    _require_enabled()

    root = os.path.realpath(NGINX_WEBROOT)
    if not os.path.isdir(root):
        raise NginxError(f"{NGINX_WEBROOT} does not exist.")

    assets = []
    for directory, _, files in os.walk(root):
        for name in files:
            full = os.path.join(directory, name)
            if os.path.islink(full):
                continue
            try:
                stat = os.stat(full)
            except OSError:
                continue
            assets.append(
                Asset(
                    path=os.path.relpath(full, root).replace(os.sep, "/"),
                    size=stat.st_size,
                    modified_at=stat.st_mtime,
                )
            )
    return sorted(assets, key=lambda asset: asset.path)


def write_asset(path: str, content: bytes) -> Asset:
    _require_enabled()

    if len(content) > NGINX_MAX_UPLOAD_BYTES:
        raise NginxError(
            f"That file is larger than the {NGINX_MAX_UPLOAD_BYTES // 1024 // 1024} MB limit."
        )

    relative = validate_asset_path(path)
    full = _webroot_path(relative)

    directory = os.path.dirname(full)
    try:
        os.makedirs(directory, exist_ok=True)
    except OSError as err:
        raise NginxError(f"Could not create {directory}: {err}")

    try:
        atomic_write(full, bytes(content))
    except FileWriteError as err:
        raise NginxError(str(err))

    stat = os.stat(full)
    return Asset(path=relative, size=stat.st_size, modified_at=stat.st_mtime)


def read_asset(path: str) -> str:
    _require_enabled()

    full = _webroot_path(validate_asset_path(path))
    try:
        with open(full, "r") as handle:
            return handle.read()
    except FileNotFoundError:
        raise NginxError(f"No file at {path!r}.")
    except (OSError, UnicodeDecodeError):
        raise NginxError(f"{path} is not a text file.")


def remove_asset(path: str) -> None:
    _require_enabled()

    full = _webroot_path(validate_asset_path(path))
    try:
        os.unlink(full)
    except FileNotFoundError:
        raise NginxError(f"No file at {path!r}.")
    except OSError as err:
        raise NginxError(f"Could not delete {path}: {err}")


def webroot_usage() -> Tuple[int, int]:
    """Bytes used under the web root, and how many files that is."""
    total = count = 0
    for asset in list_assets():
        total += asset.size
        count += 1
    return total, count


# --- logs --------------------------------------------------------------------


def read_log(name: str, lines: int = 200) -> str:
    """The tail of one of nginx's logs."""
    _require_enabled()

    filename = LOGS.get(name)
    if filename is None:
        raise NginxError(f"{name!r} is not a log this panel reads.")

    path = os.path.join(NGINX_LOG_DIR, filename)
    lines = max(1, min(lines, 2000))

    try:
        with open(path, "rb") as handle:
            # Read from the end: an access log on a busy host is far too large
            # to pull into memory for the sake of its last screenful.
            handle.seek(0, os.SEEK_END)
            size = handle.tell()
            block = min(size, lines * 512)
            handle.seek(size - block)
            tail = handle.read().decode("utf-8", errors="replace")
    except FileNotFoundError:
        raise NginxError(f"{path} does not exist yet.")
    except OSError as err:
        raise NginxError(f"Could not read {path}: {err}")

    return "\n".join(tail.splitlines()[-lines:])


def paths() -> dict:
    """Where everything lives, so the dashboard can say so."""
    return {
        "conf_dir": NGINX_CONF_DIR,
        "sites_available": NGINX_SITES_AVAILABLE,
        "sites_enabled": NGINX_SITES_ENABLED,
        "webroot": NGINX_WEBROOT,
        "log_dir": NGINX_LOG_DIR,
    }


def which() -> Optional[str]:
    """The nginx binary the panel would run, if it can find one."""
    return shutil.which(NGINX_EXECUTABLE_PATH)

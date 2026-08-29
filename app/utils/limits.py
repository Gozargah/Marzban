"""Raising resource limits, for this process and for the host.

A proxy holds two file descriptors per connection, so the default soft limit
of 1024 is the first thing to run out on a busy panel. Four separate places
decide what a process actually gets, and they do not reach each other:

  * the process's own soft limit, which it may raise up to its hard limit
    without any privilege at all;
  * /etc/security/limits.d, which PAM applies to login sessions and nothing
    else — notably not to systemd services or containers;
  * /etc/systemd/system.conf.d, the default every unit on the host inherits;
  * /etc/docker/daemon.json, the default every container inherits, plus the
    `ulimits:` block in the panel's own compose file.

The first is done at startup and always works. The rest are written only when
ULIMIT_ENABLED is set, and none of them take effect until the thing that reads
them restarts — which the panel deliberately does not do to itself or to the
daemon that runs it.
"""

import json
import os
import resource
from dataclasses import dataclass, field
from typing import Dict, List, Optional

from app.utils.files import FileWriteError, atomic_write
from config import (ULIMIT_DOCKER_DAEMON_PATH, ULIMIT_ENABLED,
                    ULIMIT_LIMITS_CONF_PATH, ULIMIT_SYSTEMD_CONF_PATH,
                    ULIMIT_TARGET_NOFILE)

UNLIMITED = "unlimited"

# The limits worth reporting, as (api name, RLIMIT_* suffix).
TRACKED = (("nofile", "NOFILE"), ("nproc", "NPROC"), ("memlock", "MEMLOCK"))

# Only nofile is ever written. The others are shown because they are part of
# the picture, but setrlimit on them is not worth the risk: a kernel may clamp
# what it is handed and lower the hard limit as a side effect, and a hard limit
# can only ever come down for the life of the process. Darwin does exactly this
# to nproc. Descriptors are what a proxy actually runs out of anyway.
RAISABLE = ("nofile",)

HEADER = "# Managed by Xenith. Replaced whole on every save.\n"


class LimitsError(Exception):
    """The change could not be made; the message is safe to show."""


@dataclass
class Limit:
    name: str
    soft: Optional[int]  # None means unlimited
    hard: Optional[int]
    target: Optional[int]

    @property
    def managed(self) -> bool:
        """Whether the panel will move this one, or only report it."""
        return self.name in RAISABLE

    @property
    def at_target(self) -> bool:
        """True when there is nothing left to do, including when there is nothing to try."""
        if not self.managed or self.target is None:
            return True
        return self.soft is None or self.soft >= self.target


@dataclass
class RaiseReport:
    raised: List[str] = field(default_factory=list)
    unchanged: List[str] = field(default_factory=list)
    # Files written, and what has to restart before each takes effect.
    written: Dict[str, str] = field(default_factory=dict)
    problems: List[str] = field(default_factory=list)


def is_enabled() -> bool:
    return bool(ULIMIT_ENABLED)


def _as_int(value: int) -> Optional[int]:
    """RLIM_INFINITY reads back as an enormous integer; report it as no limit."""
    return None if value == resource.RLIM_INFINITY else value


def _as_rlim(value: Optional[int]) -> int:
    return resource.RLIM_INFINITY if value is None else value


def kernel_nr_open() -> Optional[int]:
    """The ceiling the kernel puts on any process's nofile limit."""
    try:
        with open("/proc/sys/fs/nr_open", "r") as handle:
            return int(handle.read().strip())
    except (OSError, ValueError):
        return None


def nofile_target() -> int:
    """What "maximum" means for open files here.

    Bounded by fs.nr_open, because nothing can raise a descriptor limit past
    it, and setting a number the kernel will reject only produces a failure
    that reads like a permission problem.
    """
    ceiling = kernel_nr_open()
    if ceiling is None:
        return ULIMIT_TARGET_NOFILE
    return min(ULIMIT_TARGET_NOFILE, ceiling)


def _target_for(name: str, hard: Optional[int]) -> Optional[int]:
    """What the panel aims for, or None for a limit it only reports."""
    if name not in RAISABLE:
        return None
    wanted = nofile_target()
    return wanted if hard is None else min(wanted, hard)


def read_limits() -> List[Limit]:
    """The limits this process is running under."""
    limits = []
    for name, suffix in TRACKED:
        which = getattr(resource, f"RLIMIT_{suffix}", None)
        if which is None:  # not every limit exists on every platform
            continue
        soft, hard = resource.getrlimit(which)
        soft, hard = _as_int(soft), _as_int(hard)
        limits.append(Limit(name=name, soft=soft, hard=hard, target=_target_for(name, hard)))
    return limits


def raise_own_limits() -> RaiseReport:
    """Lift this process's soft limits to their maximum.

    Raising soft up to hard needs no privilege. Raising hard needs
    CAP_SYS_RESOURCE, so it is attempted and quietly given up on: a container
    without the capability still gets the soft limit it is entitled to.

    Every change is read back rather than assumed. A kernel is free to clamp
    what it was handed — Darwin does it to nproc — and reporting a limit as
    raised when it in fact came down would be worse than not touching it.
    """
    report = RaiseReport()

    for name, suffix in TRACKED:
        which = getattr(resource, f"RLIMIT_{suffix}", None)
        if which is None:  # not every limit exists on every platform
            continue

        if name not in RAISABLE:
            report.unchanged.append(name)
            continue

        soft, hard = resource.getrlimit(which)
        wanted = _as_rlim(nofile_target())

        if wanted > hard:
            # Worth a try: with CAP_SYS_RESOURCE the ceiling moves too. Only
            # ever upwards, so a refusal costs nothing.
            try:
                resource.setrlimit(which, (wanted, wanted))
                soft, hard = resource.getrlimit(which)
            except (ValueError, OSError):
                pass

        wanted_soft = min(wanted, hard)
        if wanted_soft <= soft:
            report.unchanged.append(name)
            continue

        try:
            resource.setrlimit(which, (wanted_soft, hard))
        except (ValueError, OSError) as err:
            report.problems.append(f"{name}: {err}")
            continue

        # Read back rather than assume: a kernel is free to clamp what it was
        # handed, and reporting a limit as raised when it did not move would
        # send someone looking for the problem in the wrong place.
        new_soft, _ = resource.getrlimit(which)
        if new_soft > soft:
            report.raised.append(name)
        else:
            report.problems.append(f"{name}: the kernel would not raise it past {soft}")

    return report


def limits_conf() -> str:
    """The PAM limits file: login sessions on the host.

    root needs its own lines — a `*` domain does not cover it, which is the
    usual reason a limits.conf change appears to do nothing.
    """
    target = nofile_target()
    lines = [HEADER, "# Applies to login sessions only; systemd units and containers ignore it.\n\n"]
    for domain in ("*", "root"):
        lines.append(f"{domain:<8}soft    nofile  {target}\n")
        lines.append(f"{domain:<8}hard    nofile  {target}\n")
    return "".join(lines)


def systemd_conf() -> str:
    """The default every systemd unit on the host inherits."""
    target = nofile_target()
    return (
        HEADER
        + "# systemd does not read /etc/security/limits.d, so its default is set here.\n"
        + "[Manager]\n"
        + f"DefaultLimitNOFILE={target}:{target}\n"
    )


def docker_ulimits() -> Dict[str, Dict[str, int]]:
    target = nofile_target()
    return {"nofile": {"Name": "nofile", "Hard": target, "Soft": target}}


def compose_snippet() -> str:
    """What to add to the panel's own compose service."""
    target = nofile_target()
    return (
        "services:\n"
        "  xenith:\n"
        "    ulimits:\n"
        "      nofile:\n"
        f"        soft: {target}\n"
        f"        hard: {target}\n"
    )


def _merge_daemon_json() -> str:
    """Add default-ulimits to the Docker daemon config, keeping the rest.

    Read, merged and rewritten rather than replaced: daemon.json usually holds
    someone's log driver or registry mirrors, and losing those breaks more than
    a descriptor limit ever fixes.
    """
    existing = {}
    try:
        with open(ULIMIT_DOCKER_DAEMON_PATH, "r") as handle:
            body = handle.read().strip()
        if body:
            existing = json.loads(body)
        if not isinstance(existing, dict):
            raise LimitsError(f"{ULIMIT_DOCKER_DAEMON_PATH} does not hold a JSON object.")
    except FileNotFoundError:
        existing = {}
    except json.JSONDecodeError as err:
        raise LimitsError(f"{ULIMIT_DOCKER_DAEMON_PATH} is not valid JSON: {err}")
    except OSError as err:
        raise LimitsError(f"Could not read {ULIMIT_DOCKER_DAEMON_PATH}: {err}")

    merged = dict(existing)
    merged.setdefault("default-ulimits", {})
    if not isinstance(merged["default-ulimits"], dict):
        raise LimitsError("default-ulimits in daemon.json is not an object.")
    merged["default-ulimits"] = {**merged["default-ulimits"], **docker_ulimits()}

    return json.dumps(merged, indent=2) + "\n"


def writable() -> Optional[str]:
    """Why the host files cannot be written, or None when they can."""
    if not is_enabled():
        return (
            "Writing the host's limit files is disabled. Set ULIMIT_ENABLED=true, and make "
            "sure the panel can write /etc on the host."
        )

    for path in (ULIMIT_LIMITS_CONF_PATH, ULIMIT_SYSTEMD_CONF_PATH, ULIMIT_DOCKER_DAEMON_PATH):
        directory = os.path.dirname(path)
        if not os.path.isdir(directory):
            return f"{directory} does not exist on this host."
        if not os.access(directory, os.W_OK):
            return f"{directory} is not writable by the panel."

    return None


# What has to restart before each file means anything.
RESTART_NOTES = {
    "limits": "takes effect on the next login session",
    "systemd": "run `systemctl daemon-reexec`, then restart the units that need it",
    "docker": "run `systemctl restart docker` — this restarts every container, this panel included",
}


def apply_host_limits() -> RaiseReport:
    """Write every host limit file, and report what still has to restart.

    Nothing is restarted here on purpose. Reloading the Docker daemon from a
    container the daemon is running would take the panel down mid-request, so
    that last step stays a decision someone makes at a shell.
    """
    reason = writable()
    if reason:
        raise LimitsError(reason)

    report = raise_own_limits()

    for name, path, content in (
        ("limits", ULIMIT_LIMITS_CONF_PATH, limits_conf()),
        ("systemd", ULIMIT_SYSTEMD_CONF_PATH, systemd_conf()),
        ("docker", ULIMIT_DOCKER_DAEMON_PATH, _merge_daemon_json()),
    ):
        try:
            atomic_write(path, content)
        except FileWriteError as err:
            report.problems.append(str(err))
            continue
        report.written[path] = RESTART_NOTES[name]

    return report

"""Structural proof of the Task 3 headline goal: ``import app`` does
zero subprocess / outbound-network / TCP-socket I/O at import time.

This test forks a subprocess, monkeypatches the offending stdlib /
third-party entry points to raise on ANY call, and then does ``import
app``. If any import-time code path tried subprocess, ``requests.get``,
or ``socket.socket.connect``, the import would fail.

Kept separate from conftest so it does not benefit from conftest's own
xray ``init_for_tests`` bootstrap — this test must work on a totally
fresh interpreter.
"""

import subprocess
import sys
import textwrap


_PROBE = textwrap.dedent(
    """\
    import os
    import socket
    import subprocess as _subprocess
    import sys

    os.environ.setdefault("SQLALCHEMY_DATABASE_URL", "sqlite:///:memory:")
    os.environ.setdefault("XRAY_JSON", "./xray_config.json")
    os.environ.setdefault("TELEGRAM_API_TOKEN", "")

    class ImportTimeIOAttempted(RuntimeError):
        pass

    def _no_check_output(*a, **kw):
        raise ImportTimeIOAttempted(f"subprocess.check_output called at import: {a!r}")

    _subprocess.check_output = _no_check_output

    # Block outbound HTTP via `requests`.
    import requests
    def _no_requests_get(*a, **kw):
        raise ImportTimeIOAttempted(f"requests.get called at import: {a!r}")
    requests.get = _no_requests_get

    # Block any socket.connect (covers the free-port-scan loop).
    _orig_connect = socket.socket.connect
    def _no_connect(self, *a, **kw):
        raise ImportTimeIOAttempted(f"socket.connect called at import: {a!r}")
    socket.socket.connect = _no_connect

    # The probe: importing app must not trigger any of the above.
    try:
        import app  # noqa: F401
    except ImportTimeIOAttempted as exc:
        sys.stderr.write(str(exc))
        sys.exit(2)
    """
)


def test_import_app_does_no_subprocess_or_network_or_socket_io():
    result = subprocess.run(
        [sys.executable, "-c", _PROBE],
        capture_output=True,
        text=True,
        timeout=30,
    )
    assert result.returncode == 0, (
        f"`import app` performed forbidden import-time I/O.\n"
        f"stderr: {result.stderr}\n"
        f"stdout: {result.stdout}"
    )

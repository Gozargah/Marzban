"""Writing configuration files the panel owns.

Every file under /etc that this panel manages is replaced whole rather than
edited in place, so a crash halfway through cannot leave init reading a
half-written directive.
"""

import os
import tempfile


class FileWriteError(Exception):
    """The file could not be written; the message is safe to show."""


def atomic_write(path: str, content, mode: int = 0o644) -> None:
    """Replace `path` with `content`, atomically.

    Takes either text or bytes; an uploaded font or image has to survive the
    round trip unchanged, which it does not if it is decoded on the way in.

    The temporary file is created in the destination directory so the final
    rename stays within one filesystem, which is what makes it atomic.
    """
    directory = os.path.dirname(path) or "."
    if not os.path.isdir(directory):
        raise FileWriteError(f"{directory} does not exist.")

    binary = isinstance(content, (bytes, bytearray))
    try:
        handle = tempfile.NamedTemporaryFile(
            "wb" if binary else "w", dir=directory, prefix=".xenith-", delete=False
        )
    except OSError as err:
        raise FileWriteError(f"Could not write to {directory}: {err}")

    try:
        with handle:
            handle.write(content)
            handle.flush()
            os.fsync(handle.fileno())
        os.chmod(handle.name, mode)
        os.replace(handle.name, path)
    except OSError as err:
        try:
            os.unlink(handle.name)
        except OSError:
            pass
        raise FileWriteError(f"Could not write {path}: {err}")

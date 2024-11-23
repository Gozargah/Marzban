from . import exceptions
from . import exceptions as exc
from . import types
from .proxyman import Proxyman
from .stats import Stats


class XRay(Proxyman, Stats):
    pass


__all__ = ["XRay", "exceptions", "exc", "types"]

from typing import TYPE_CHECKING, Optional, Sequence, TypedDict

from app import xray
from app.models.proxy import ProxyHostSecurity

if TYPE_CHECKING:
    from app.db.models import ProxyHost


class HostDict(TypedDict):
    remark: str
    address: str
    port: int
    sni: str
    host: str
    tls: Optional[bool]


class XrayStore:
    _is_fetched = False
    _hosts: dict[str, list[HostDict]] = {}

    @property
    def hosts(self) -> dict[str, list[HostDict]]:
        if not self._is_fetched:
            self.update_hosts()

        return self._hosts

    def update_hosts(self):
        from app.db import GetDB, crud

        self._hosts = {}
        with GetDB() as db:
            self._is_fetched = True

            for inbound_tag in xray.config.inbounds_by_tag:
                inbound_hosts: Sequence[ProxyHost] = crud.get_hosts(db, inbound_tag)

                self._hosts[inbound_tag] = [
                    {
                        "remark": host.remark,
                        "address": host.address,
                        "port": host.port,
                        "sni": host.sni,
                        "host": host.host,
                        # None means the tls is not specified by host itself and
                        #  complies with its inbound's settings.
                        "tls": None
                        if host.security == ProxyHostSecurity.inbound_default
                        else host.security == ProxyHostSecurity.tls,
                    } for host in inbound_hosts
                ]


XRAY_STORE = XrayStore()


class MemoryStorage:
    def __init__(self):
        self._data = {}

    def set(self, key, value):
        self._data[key] = value

    def get(self, key, default=None):
        return self._data.get(key, default)

    def delete(self, key):
        self._data.pop(key, None)

    def clear(self):
        self._data.clear()

from typing import TYPE_CHECKING, Sequence
from app import app, xray
from app.models.proxy import ProxyHostSecurity

if TYPE_CHECKING:
    from app.db.models import ProxyHost


class XrayStore:
    HOSTS = {
        "INBOUND_TAG": [
            {
                "remark": "",
                "address": "",
                "port": None,
                "sni": "",
                "host": "",
                "tls": None,
            }
        ]
    }

    @classmethod
    def update_hosts(cls):
        from app.db import GetDB, crud

        cls.HOSTS = {}
        with GetDB() as db:
            for inbound_tag in xray.config.inbounds_by_tag:
                hosts: Sequence[ProxyHost] = crud.get_hosts(db, inbound_tag)
                cls.HOSTS[inbound_tag] = []
                for host in hosts:
                    cls.HOSTS[inbound_tag].append(
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
                        }
                    )


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


@app.on_event("startup")
def app_startup():
    XrayStore.update_hosts()

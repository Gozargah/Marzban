from app import app, xray


class XrayStore:
    HOSTS = {
        "INBOUND_TAG": [
            {
                "remark": "",
                "address": "",
                "port": None,
                "sni": "",
                "host": "",
            }
        ]
    }

    @classmethod
    def update_hosts(cls):
        from app.db import GetDB, crud

        cls.HOSTS = {}
        with GetDB() as db:
            for inbound_tag in xray.config.inbounds_by_tag:
                hosts = crud.get_hosts(db, inbound_tag)
                cls.HOSTS[inbound_tag] = []
                for host in hosts:
                    cls.HOSTS[inbound_tag].append(
                        {
                            "remark": host.remark,
                            "address": host.address,
                            "port": host.port,
                            "sni": host.sni,
                            "host": host.host,
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

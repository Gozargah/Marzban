import json


class OutlineConfiguration:
    def __init__(self):
        self.config = {}

    def add_directly(self, data: dict):
        self.config.update(data)

    def render(self, reverse=False):
        if reverse:
            items = list(self.config.items())
            items.reverse()
            self.config = dict(items)
        return json.dumps(self.config, indent=0)

    def make_outbound(
        self, remark: str, address: str, port: int, password: str, method: str
    ):
        config = {
            "method": method,
            "password": password,
            "server": address,
            "server_port": port,
            "tag": remark,
        }
        return config

    def add(self, remark: str, address: str, inbound: dict, settings: dict):
        if inbound["protocol"] != "shadowsocks":
            return

        outbound = self.make_outbound(
            remark=remark,
            address=address,
            port=inbound["port"],
            password=settings["password"],
            method=settings["method"],
        )
        self.add_directly(outbound)
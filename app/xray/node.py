import tempfile
import threading
from typing import List

import rpyc

from app.xray.config import XRayConfig


class XRayNode:

    def __init__(self,
                 address: str,
                 port: int,
                 ssl_cert: str):

        class Service(rpyc.Service):
            def __init__(self,
                         on_start_funcs: List[callable] = [],
                         on_stop_funcs: List[callable] = []):
                self.on_start_funcs = on_start_funcs
                self.on_stop_funcs = on_stop_funcs

            def exposed_on_start(self):
                for func in self.on_start_funcs:
                    threading.Thread(target=func).start()

            def exposed_on_stop(self):
                for func in self.on_stop_funcs:
                    threading.Thread(target=func).start()

            def add_startup_func(self, func):
                self.on_start_funcs.append(func)

            def add_shutdown_func(self, func):
                self.on_stop_funcs.append(func)

            def on_connect(self, conn):
                pass

            def on_disconnect(self, conn):
                pass

        self.address = address
        self.port = port
        self._certfile = tempfile.NamedTemporaryFile(mode='w+t')
        self._certfile.write(ssl_cert)
        self._certfile.flush()

        self._service = Service()

        self.connect()

    def connect(self):
        tries = 0
        while True:
            tries += 1
            conn = rpyc.ssl_connect(self.address,
                                    self.port,
                                    service=self._service,
                                    ca_certs=self._certfile.name)
            try:
                conn.ping()
                self.connection = conn
                break
            except EOFError:
                if tries <= 3:
                    continue
                raise RuntimeError(f'Unable to connect to the node {self.address}:{self.port} after 3 attempts')

    @property
    def remote(self):
        try:
            return self.connection.root
        except EOFError:
            self.connect()

    def start(self, config: XRayConfig):
        json_config = config.to_json()
        self.remote.start(json_config)

    def stop(self):
        self.remote.stop()

    def restart(self, config: XRayConfig):
        json_config = config.to_json()
        self.remote.restart(json_config)

    def on_start(self, func: callable):
        self._service.add_startup_func(func)
        return func

    def on_stop(self, func: callable):
        self._service.add_shutdown_func(func)
        return func

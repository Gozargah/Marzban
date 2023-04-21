import tempfile
import threading
from typing import List

import rpyc

from app.xray.config import XRayConfig
from xray_api import XRay as XRayAPI


class XRayNode:

    def __init__(self,
                 address: str,
                 port: int,
                 api_port: int,
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
        self.api_port = api_port
        self.ssl_cert = ssl_cert

        self.started = False

        self._certfile = tempfile.NamedTemporaryFile(mode='w+t')
        self._certfile.write(ssl_cert)
        self._certfile.flush()

        self._service = Service()

    def disconnect(self):
        try:
            self.connection.close()
            del self.connection
        except AttributeError:
            pass

    def connect(self):
        self.disconnect()

        tries = 0
        while True:
            tries += 1
            conn = rpyc.ssl_connect(self.address,
                                    self.port,
                                    service=self._service,
                                    ca_certs=self._certfile.name,
                                    keepalive=True)
            try:
                conn.ping()
                self.connection = conn
                break
            except EOFError:
                if tries <= 3:
                    continue
                raise RuntimeError(f'Unable to connect after 3 attempts')

    @property
    def connected(self):
        try:
            self.connection.ping()
            return (not self.connection.closed)
        except (AttributeError, EOFError):
            self.disconnect()
            return False

    @property
    def remote(self):
        if not self.connected:
            self.connect()
        return self.connection.root

    @property
    def api(self):
        if not self.connected:
            raise ConnectionError("Node is not connected")

        if not self.started:
            raise ConnectionError("Node is not started")

        try:
            return self._api
        except AttributeError:
            self._api = XRayAPI(
                address=self.address,
                port=self.api_port,
                ssl_cert=self.ssl_cert.encode(),
                ssl_target_name="Gozargah"
            )
            return self._api

    def start(self, config: XRayConfig):
        json_config = config.to_json()
        self.remote.start(json_config)
        self.started = True

    def stop(self):
        self.remote.stop()
        self.started = False

    def restart(self, config: XRayConfig):
        json_config = config.to_json()
        self.remote.restart(json_config)

    def on_start(self, func: callable):
        self._service.add_startup_func(func)
        return func

    def on_stop(self, func: callable):
        self._service.add_shutdown_func(func)
        return func

import re
import ssl
import tempfile
import threading
import time
from collections import deque
from contextlib import contextmanager
from typing import List

import grpc
import rpyc

from app.xray.config import XRayConfig
from xray_api import XRay as XRayAPI


def string_to_temp_file(content: str):
    file = tempfile.NamedTemporaryFile(mode='w+t')
    file.write(content)
    file.flush()
    return file


class XRayNode:

    def __init__(self,
                 address: str,
                 port: int,
                 api_port: int,
                 ssl_key: str,
                 ssl_cert: str,
                 usage_coefficient: float = 1):

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
        self.ssl_key = ssl_key
        self.ssl_cert = ssl_cert
        self.usage_coefficient = usage_coefficient

        self.started = False

        self._keyfile = string_to_temp_file(ssl_key)
        self._certfile = string_to_temp_file(ssl_cert)

        self._service = Service()
        self._api = None

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
            self._node_cert = ssl.get_server_certificate((self.address, self.port))
            self._node_certfile = string_to_temp_file(self._node_cert)
            conn = rpyc.ssl_connect(self.address,
                                    self.port,
                                    service=self._service,
                                    keyfile=self._keyfile.name,
                                    certfile=self._certfile.name,
                                    ca_certs=self._node_certfile.name,
                                    keepalive=True)
            try:
                conn.ping()
                self.connection = conn
                break
            except EOFError as exc:
                if tries <= 3:
                    continue
                raise exc

    @property
    def connected(self):
        try:
            self.connection.ping()
            return (not self.connection.closed)
        except (AttributeError, EOFError, TimeoutError):
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

        return self._api

    def _prepare_config(self, config: XRayConfig):
        for inbound in config.get("inbounds", []):
            streamSettings = inbound.get("streamSettings") or {}
            tlsSettings = streamSettings.get("tlsSettings") or {}
            certificates = tlsSettings.get("certificates") or []
            for certificate in certificates:
                if certificate.get("certificateFile"):
                    with open(certificate['certificateFile']) as file:
                        certificate['certificate'] = [
                            line.strip() for line in file.readlines()
                        ]
                        del certificate['certificateFile']

                if certificate.get("keyFile"):
                    with open(certificate['keyFile']) as file:
                        certificate['key'] = [
                            line.strip() for line in file.readlines()
                        ]
                        del certificate['keyFile']

        return config

    def start(self, config: XRayConfig):
        config = self._prepare_config(config)
        json_config = config.to_json()
        self.remote.start(json_config)
        self.started = True

        # connect to API
        self._api = XRayAPI(
            address=self.address,
            port=self.api_port,
            ssl_cert=self._node_cert.encode(),
            ssl_target_name="Gozargah"
        )
        try:
            grpc.channel_ready_future(self._api._channel).result(timeout=5)
        except grpc.FutureTimeoutError:

            start_time = time.time()
            end_time = start_time + 3  # check logs for 3 seconds
            last_log = ''
            with self.get_logs() as logs:
                while time.time() < end_time:
                    if logs:
                        last_log = logs[-1].strip().split('\n')[-1]
                    time.sleep(0.1)

            self.disconnect()

            if re.search(r'[Ff]ailed', last_log):
                raise RuntimeError(last_log)

            raise ConnectionError('Failed to connect to node\'s API')

    def stop(self):
        self.remote.stop()
        self.started = False
        self._api = None

    def restart(self, config: XRayConfig):
        self.started = False
        config = self._prepare_config(config)
        json_config = config.to_json()
        self.remote.restart(json_config)
        self.started = True

    @contextmanager
    def get_logs(self):
        if not self.connected:
            raise ConnectionError("Node is not connected")

        try:
            self.__curr_logs
        except AttributeError:
            self.__curr_logs = 0

        try:
            buf = deque(maxlen=100)

            if self.__curr_logs <= 0:
                self.__curr_logs = 1
                self.__bgsrv = rpyc.BgServingThread(self.connection)
            else:
                if not self.__bgsrv._active:
                    self.__bgsrv = rpyc.BgServingThread(self.connection)
                self.__curr_logs += 1

            logs = self.remote.fetch_logs(buf.append)
            yield buf

        finally:
            if self.__curr_logs <= 1:
                self.__curr_logs = 0
                self.__bgsrv.stop()
            else:
                if not self.__bgsrv._active:
                    self.__bgsrv = rpyc.BgServingThread(self.connection)
                self.__curr_logs -= 1

            if logs:
                logs.stop()

    def on_start(self, func: callable):
        self._service.add_startup_func(func)
        return func

    def on_stop(self, func: callable):
        self._service.add_shutdown_func(func)
        return func

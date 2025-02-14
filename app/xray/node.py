import socket
import re
import ssl
import tempfile
import threading
import time
import os
from collections import deque
from contextlib import contextmanager
from typing import List, Callable, Optional

import grpc
import requests
import rpyc
from requests.adapters import HTTPAdapter
from requests.packages.urllib3.poolmanager import PoolManager
from websocket import WebSocketConnectionClosedException, WebSocketTimeoutException, create_connection

from app.xray.config import XRayConfig
from xray_api import XRay as XRayAPI


class ManagedTempFile:
    def __init__(self, content: str):
        self.file = None
        self.name = None
        self.closed = False
        try:
            self.file = tempfile.NamedTemporaryFile(mode='w+t', delete=True)
            self.file.write(content)
            self.file.flush()
            self.name = self.file.name
        except Exception as e:
            if self.file:
                self.close()
            raise

    def close(self):
        if not self.closed:
            try:
                self.file.close()
            except Exception:
                pass
            try:
                if os.path.exists(self.name):
                    os.unlink(self.name)
            except Exception:
                pass
            self.closed = True

    def __enter__(self):
        return self

    def __exit__(self, exc_type, exc_value, traceback):
        self.close()


class SANIgnoringAdaptor(HTTPAdapter):
    def init_poolmanager(self, connections, maxsize, block=False):
        self.poolmanager = PoolManager(num_pools=connections,
                                       maxsize=maxsize,
                                       block=block,
                                       assert_hostname=False)


class NodeAPIError(Exception):
    def __init__(self, status_code, detail):
        self.status_code = status_code
        self.detail = detail


class ReSTXRayNode:
    def __init__(self,
                 address: str,
                 port: int,
                 api_port: int,
                 ssl_key: str,
                 ssl_cert: str,
                 usage_coefficient: float = 1):

        self.address = address
        self.port = port
        self.api_port = api_port
        self.ssl_key = ssl_key
        self.ssl_cert = ssl_cert
        self.usage_coefficient = usage_coefficient

        self._keyfile = ManagedTempFile(ssl_key)
        self._certfile = ManagedTempFile(ssl_cert)

        self.session = requests.Session()
        self.session.mount('https://', SANIgnoringAdaptor())
        self.session.cert = (self._certfile.name, self._keyfile.name)

        self._session_id = None
        self._rest_api_url = f"https://{self.address.strip('/')}:{self.port}"

        self._ssl_context = ssl.create_default_context()
        self._ssl_context.check_hostname = False
        self._ssl_context.verify_mode = ssl.CERT_NONE
        self._ssl_context.load_cert_chain(certfile=self.session.cert[0], keyfile=self.session.cert[1])
        self._logs_ws_url = f"wss://{self.address.strip('/')}:{self.port}/logs"
        self._logs_queues = []
        self._logs_lock = threading.Lock()
        self._logs_bg_thread = None
        self._logs_stop_event = threading.Event()

        self._api = None
        self._started = False

        self._node_cert = None
        self._node_certfile = None

        self._running = False

    def shutdown(self):
        if self._logs_bg_thread and self._logs_bg_thread.is_alive():
            self._logs_stop_event.set()
            self._logs_bg_thread.join()
        if hasattr(self, '_keyfile') and self._keyfile:
            self._keyfile.close()
        if hasattr(self, '_certfile') and self._certfile:
            self._certfile.close()
        if self._node_certfile:
            self._node_certfile.close()
        self._running = False

    def _prepare_config(self, config: XRayConfig):
        for inbound in config.get("inbounds", []):
            streamSettings = inbound.get("streamSettings") or {}
            tlsSettings = streamSettings.get("tlsSettings") or {}
            certificates = tlsSettings.get("certificates") or []
            for certificate in certificates:
                if certificate.get("certificateFile"):
                    with open(certificate['certificateFile']) as file:
                        certificate['certificate'] = [line.strip() for line in file.readlines()]
                        del certificate['certificateFile']
                if certificate.get("keyFile"):
                    with open(certificate['keyFile']) as file:
                        certificate['key'] = [line.strip() for line in file.readlines()]
                        del certificate['keyFile']
        return config

    def make_request(self, path: str, timeout: int, **params):
        try:
            res = self.session.post(self._rest_api_url + path, timeout=timeout,
                                    json={"session_id": self._session_id, **params})
            res.raise_for_status()
            data = res.json()
        except Exception as e:
            raise NodeAPIError(0, str(e))
        if res.status_code == 200:
            return data
        else:
            raise NodeAPIError(res.status_code, data.get('detail', 'Unknown error'))

    @property
    def connected(self):
        if not self._session_id:
            return False
        try:
            self.make_request("/ping", timeout=3)
            return True
        except NodeAPIError:
            return False

    @property
    def started(self):
        return self._started

    @property
    def api(self):
        if not self._session_id:
            raise ConnectionError("Node is not connected")
        if not self._api:
            if self._started:
                self._api = XRayAPI(
                    address=self.address,
                    port=self.api_port,
                    ssl_cert=self._node_cert.encode(),
                    ssl_target_name="Gozargah"
                )
            else:
                raise ConnectionError("Node is not started")
        return self._api

    def connect(self):
        max_retries = 3
        total_timeout = 30
        start_time = time.time()
        for attempt in range(max_retries):
            try:
                self._node_cert = ssl.get_server_certificate((self.address, self.port))
                self._node_certfile = ManagedTempFile(self._node_cert)
                self.session.verify = self._node_certfile.name
                res = self.make_request("/connect", timeout=3)
                self._session_id = res['session_id']
                return
            except (NodeAPIError, requests.exceptions.Timeout) as e:
                if time.time() - start_time > total_timeout:
                    raise ConnectionError(f"Connection failed after {total_timeout} seconds.")
                delay = 2 ** attempt
                time.sleep(delay)
        raise ConnectionError("Connection failed after retries.")

    def disconnect(self):
        try:
            self.make_request("/disconnect", timeout=3)
        except NodeAPIError:
            pass
        self._session_id = None

    def get_version(self):
        res = self.make_request("/", timeout=3)
        return res.get('core_version')

    def start(self, config: XRayConfig):
        if not self.connected:
            self.connect()
        try:
            config = self._prepare_config(config)
        except FileNotFoundError as e:
            raise NodeAPIError(400, f"Configuration error: {str(e)}")

        json_config = config.to_json()
        try:
            res = self.make_request("/start", timeout=10, config=json_config)
        except NodeAPIError as exc:
            if exc.detail == 'Xray is started already':
                return self.restart(config)
            else:
                raise exc
        self._started = True
        try:
            self._api = XRayAPI(
                address=self.address,
                port=self.api_port,
                ssl_cert=self._node_cert.encode(),
                ssl_target_name="Gozargah"
            )
        except Exception as e:
            self._started = False
            raise ConnectionError(f"API init failed: {e}")
        try:
            grpc.channel_ready_future(self._api._channel).result(timeout=5)
        except grpc.FutureTimeoutError:
            raise ConnectionError("Failed to connect to node's API")
        return res

    def stop(self):
        if not self.connected:
            self.connect()
        self.make_request('/stop', timeout=5)
        self._api = None
        self._started = False

    def restart(self, config: XRayConfig):
        if not self.connected:
            self.connect()
        config = self._prepare_config(config)
        json_config = config.to_json()
        res = self.make_request("/restart", timeout=10, config=json_config)
        self._started = True
        self._api = XRayAPI(
            address=self.address,
            port=self.api_port,
            ssl_cert=self._node_cert.encode(),
            ssl_target_name="Gozargah"
        )
        try:
            grpc.channel_ready_future(self._api._channel).result(timeout=5)
        except grpc.FutureTimeoutError:
            raise ConnectionError("Failed to connect to node's API")
        return res

    def _bg_fetch_logs(self):
        self._running = True
        while not self._logs_stop_event.is_set():
            ws = None
            try:
                websocket_url = f"{self._logs_ws_url}?session_id={self._session_id}&interval=0.7"
                self._ssl_context = ssl.create_default_context()
                self._ssl_context.load_verify_locations(self.session.verify)
                ws = create_connection(websocket_url, sslopt={"context": self._ssl_context}, timeout=5)
                ws.settimeout(5)
                while not self._logs_stop_event.is_set():
                    try:
                        log_line = ws.recv()
                        with self._logs_lock:
                            for buf in self._logs_queues:
                                buf.append(log_line)
                    except WebSocketTimeoutException:
                        continue
                    except (WebSocketConnectionClosedException, ConnectionResetError):
                        break
                    except Exception:
                        break
            except (socket.timeout, OSError, ssl.SSLError):
                pass
            except Exception:
                pass
            finally:
                if ws:
                    try:
                        ws.close()
                    except Exception:
                        pass
            if not self._logs_stop_event.is_set():
                time.sleep(2)

    @contextmanager
    def get_logs(self):
        buf = deque(maxlen=100)
        with self._logs_lock:
            self._logs_queues.append(buf)
            if self._logs_bg_thread is None or not self._logs_bg_thread.is_alive():
                self._logs_stop_event.clear()
                self._logs_bg_thread = threading.Thread(target=self._bg_fetch_logs, daemon=True)
                try:
                    self._logs_bg_thread.start()
                except RuntimeError:
                    pass
        try:
            yield buf
        finally:
            with self._logs_lock:
                try:
                    self._logs_queues.remove(buf)
                except ValueError:
                    pass


class RPyCXRayNode:
    def __init__(self,
                 address: str,
                 port: int,
                 api_port: int,
                 ssl_key: str,
                 ssl_cert: str,
                 usage_coefficient: float = 1):

        class Service(rpyc.Service):
            def __init__(self,
                         on_start_funcs: Optional[List[Callable]] = None,
                         on_stop_funcs: Optional[List[Callable]] = None):
                self.on_start_funcs = on_start_funcs if on_start_funcs is not None else []
                self.on_stop_funcs = on_stop_funcs if on_stop_funcs is not None else []

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
        self.connection = None

        self._keyfile = ManagedTempFile(ssl_key)
        self._certfile = ManagedTempFile(ssl_cert)

        self._service = Service()
        self._api = None

        self.__logs_lock = threading.Lock()
        self.__bgsrv = None

        self._node_cert = None
        self._node_certfile = None

    def shutdown(self):
        self._keyfile.close()
        self._certfile.close()
        if self._node_certfile:
            self._node_certfile.close()
        if self.__bgsrv:
            self.__bgsrv.stop()

    def disconnect(self):
        try:
            if self.connection:
                self.connection.close()
            self.connection = None
        except AttributeError:
            pass

    def connect(self):
        self.disconnect()
        tries = 0
        max_attempts = 3
        total_timeout = 10
        start_time = time.time()
        while tries < max_attempts:
            if self._node_certfile:
                self._node_certfile.close()
            tries += 1
            try:
                self._node_cert = ssl.get_server_certificate((self.address, self.port))
                self._node_certfile = ManagedTempFile(self._node_cert)
                conn = rpyc.ssl_connect(
                    self.address,
                    self.port,
                    service=self._service,
                    keyfile=self._keyfile.name,
                    certfile=self._certfile.name,
                    ca_certs=self._node_certfile.name,
                    keepalive=True
                )
                conn.ping()
                self.connection = conn
                break
            except (EOFError, socket.error, TimeoutError) as e:
                if time.time() - start_time > total_timeout:
                    raise ConnectionError(
                        f"Unable to connect to node via RPyC after {total_timeout} seconds: {e}") from e
                time.sleep(1)
        if not self.connection:
            raise ConnectionError("Unable to connect to node via RPyC after multiple attempts.")

    @property
    def connected(self):
        try:
            if self.connection:
                self.connection.ping()
                return not self.connection.closed
            return False
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

    def get_version(self):
        return self.remote.fetch_xray_version()

    def _prepare_config(self, config: XRayConfig):
        for inbound in config.get("inbounds", []):
            streamSettings = inbound.get("streamSettings") or {}
            tlsSettings = streamSettings.get("tlsSettings") or {}
            certificates = tlsSettings.get("certificates") or []
            for certificate in certificates:
                if certificate.get("certificateFile"):
                    with open(certificate['certificateFile']) as file:
                        certificate['certificate'] = [line.strip() for line in file.readlines()]
                        del certificate['certificateFile']
                if certificate.get("keyFile"):
                    with open(certificate['keyFile']) as file:
                        certificate['key'] = [line.strip() for line in file.readlines()]
                        del certificate['keyFile']
        return config

    def start(self, config: XRayConfig):
        config = self._prepare_config(config)
        json_config = config.to_json()
        self.remote.start(json_config)
        self.started = True
        self._api = XRayAPI(
            address=self.address,
            port=self.api_port,
            ssl_cert=self._node_cert.encode(),
            ssl_target_name="Gozargah"
        )
        api_timeout = 10
        try:
            grpc.channel_ready_future(self._api._channel).result(timeout=api_timeout)
        except grpc.FutureTimeoutError as e:
            self.disconnect()
            raise ConnectionError(f"Failed to connect to node's API after {api_timeout} seconds") from e

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

    def _bg_fetch_logs(self, buf: deque, stop_event: threading.Event):
        while not stop_event.is_set():
            with self.__logs_lock:
                new_logs = self.remote.fetch_logs()
                if new_logs:
                    for log_line in new_logs:
                        buf.append(log_line)
            time.sleep(0.5)

    @contextmanager
    def get_logs(self):
        if not self.connected:
            raise ConnectionError("Node is not connected")
        with self.__logs_lock:
            if self.__bgsrv is None or not self.__bgsrv.is_alive():
                self.__bgsrv = rpyc.BgServingThread(self.connection)
        buf = deque(maxlen=100)
        stop_event = threading.Event()
        thread = threading.Thread(target=self._bg_fetch_logs, args=(buf, stop_event), daemon=True)
        thread.start()
        try:
            yield buf
        finally:
            stop_event.set()
            thread.join()

    def on_start(self, func: Callable):
        self._service.add_startup_func(func)
        return func

    def on_stop(self, func: Callable):
        self._service.add_shutdown_func(func)
        return func


class XRayNode:
    def __new__(cls,
                address: str,
                port: int,
                api_port: int,
                ssl_key: str,
                ssl_cert: str,
                usage_coefficient: float = 1):
        try:
            s = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
            s.settimeout(3)
            s.connect((address, port))
            s.send(b'HEAD / HTTP/1.0\r\n\r\n')
            response = s.recv(1024)
            s.close()
            if response.startswith(b'HTTP'):
                return ReSTXRayNode(address=address,
                                     port=port,
                                     api_port=api_port,
                                     ssl_key=ssl_key,
                                     ssl_cert=ssl_cert,
                                     usage_coefficient=usage_coefficient)
        except Exception:
            pass
        return RPyCXRayNode(address=address,
                            port=port,
                            api_port=api_port,
                            ssl_key=ssl_key,
                            ssl_cert=ssl_cert,
                            usage_coefficient=usage_coefficient)

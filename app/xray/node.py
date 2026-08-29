import socket
import re
import ssl
import tempfile
import threading
import time
from collections import deque
from contextlib import contextmanager
from hashlib import sha256
from typing import List, Optional

import grpc
import requests
import rpyc
from requests.adapters import HTTPAdapter
from requests.packages.urllib3.poolmanager import PoolManager
from websocket import WebSocketConnectionClosedException, WebSocketTimeoutException, create_connection

from app.xray.config import XRayConfig
from xray_api import XRay as XRayAPI


def string_to_temp_file(content: str):
    file = tempfile.NamedTemporaryFile(mode='w+t')
    file.write(content)
    file.flush()
    return file


class SANIgnoringAdaptor(HTTPAdapter):
    def init_poolmanager(self, connections, maxsize, block=False):
        self.poolmanager = PoolManager(num_pools=connections,
                                       maxsize=maxsize,
                                       block=block,
                                       assert_hostname=False)


# Fetching a node's certificate is a plain TLS handshake with no timeout of its
# own: a node that accepts the connection and then says nothing would otherwise
# hold the calling thread for as long as the kernel allows.
CERTIFICATE_FETCH_TIMEOUT = 15


def certificate_fingerprint(pem: str) -> str:
    """SHA-256 fingerprint of a PEM encoded certificate."""
    return sha256(ssl.PEM_cert_to_DER_cert(pem)).hexdigest()


class NodeCertificateMismatch(Exception):
    """Raised when a node presents a certificate other than the pinned one.

    Either the connection is being intercepted, or the node was reinstalled and
    generated a fresh certificate. The pinned certificate has to be reset
    explicitly before such a node can be reached again.
    """

    def __init__(self, expected: str, presented: str):
        self.expected = expected
        self.presented = presented
        super().__init__(
            "The node presented a certificate that does not match the pinned one "
            f"(pinned {expected[:16]}…, got {presented[:16]}…). If you reinstalled "
            "this node, reset its pinned certificate before reconnecting."
        )


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
                 usage_coefficient: float = 1,
                 server_cert: Optional[str] = None):

        self.address = address
        self.port = port
        self.api_port = api_port
        self.ssl_key = ssl_key
        self.ssl_cert = ssl_cert
        self.usage_coefficient = usage_coefficient

        self._keyfile = string_to_temp_file(ssl_key)
        self._certfile = string_to_temp_file(ssl_cert)

        self.session = requests.Session()
        self.session.mount('https://', SANIgnoringAdaptor())
        self.session.cert = (self._certfile.name, self._keyfile.name)

        self._session_id = None
        self._rest_api_url = f"https://{self.address.strip('/')}:{self.port}"

        # Nodes present a self-signed certificate, so the pinned certificate is
        # used as the only trust anchor. Hostname checking stays off because the
        # certificate's subject does not carry the node's address — which is
        # what makes the trust store the whole of the check, and why this is
        # built empty rather than with create_default_context(). That helper
        # differs from a bare client context in exactly one way, the system
        # roots it loads, and those have no business here: with the hostname
        # unchecked, any certificate signed by any public CA would otherwise
        # be accepted for a node, so anyone able to answer on the node's
        # address could serve its logs. `verify_mode` is already CERT_REQUIRED
        # and the protocol floor already TLS 1.2; only the anchors change.
        self._ssl_context = ssl.SSLContext(ssl.PROTOCOL_TLS_CLIENT)
        self._ssl_context.check_hostname = False
        self._ssl_context.load_cert_chain(certfile=self.session.cert[0], keyfile=self.session.cert[1])

        self._node_cert = None
        self._node_certfile = None
        if server_cert:
            self._pin_certificate(server_cert)
        self._logs_ws_url = f"wss://{self.address.strip('/')}:{self.port}/logs"
        self._logs_queues = []
        self._logs_bg_thread = threading.Thread(target=self._bg_fetch_logs, daemon=True)

        self._api = None
        self._started = False

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

    def make_request(self, path: str, timeout: int, **params):
        try:
            res = self.session.post(self._rest_api_url + path, timeout=timeout,
                                    json={"session_id": self._session_id, **params})
            data = res.json()
        except Exception as e:
            exc = NodeAPIError(0, str(e))
            raise exc

        if res.status_code == 200:
            return data
        else:
            exc = NodeAPIError(res.status_code, data['detail'])
            raise exc

    @property
    def connected(self):
        if not self._session_id:
            return False
        try:
            self.make_request("/ping", timeout=30)
            return True
        except NodeAPIError:
            return False

    @property
    def started(self):
        res = self.make_request("/", timeout=30)
        return res.get('started', False)

    @property
    def api(self):
        if not self._session_id:
            raise ConnectionError("Node is not connected")

        if not self._api:
            if self._started is True:
                self._api = XRayAPI(
                    address=self.address,
                    port=self.api_port,
                    ssl_cert=self._node_cert.encode(),
                    ssl_target_name="Gozargah"
                )
            else:
                raise ConnectionError("Node is not started")

        return self._api

    def _pin_certificate(self, pem: str) -> None:
        """Trust this certificate, and only this one, for the node.

        Loaded into the log stream's SSL context here rather than where that
        stream connects: the context outlives every reconnect, so loading it
        per attempt piles the same certificate into it once every two seconds
        for as long as anybody is watching the logs.
        """
        self._node_cert = pem
        self._node_certfile = string_to_temp_file(pem)
        self.session.verify = self._node_certfile.name
        self._ssl_context.load_verify_locations(self._node_certfile.name)

    @property
    def server_cert(self) -> Optional[str]:
        """The certificate pinned for this node, if one has been established."""
        return self._node_cert

    def connect(self):
        presented = ssl.get_server_certificate(
            (self.address, self.port), timeout=CERTIFICATE_FETCH_TIMEOUT
        )

        if self._node_cert is None:
            # Trust on first use: nodes generate their own certificate, so the
            # panel cannot know it in advance. It is persisted by the caller and
            # enforced from the next connection onwards.
            self._pin_certificate(presented)
        elif certificate_fingerprint(presented) != certificate_fingerprint(self._node_cert):
            raise NodeCertificateMismatch(
                expected=certificate_fingerprint(self._node_cert),
                presented=certificate_fingerprint(presented),
            )

        res = self.make_request("/connect", timeout=30)
        self._session_id = res['session_id']

    def disconnect(self):
        self.make_request("/disconnect", timeout=30)
        self._session_id = None

    def get_version(self):
        res = self.make_request("/", timeout=30)
        return res.get('core_version')

    def start(self, config: XRayConfig):
        if not self.connected:
            self.connect()

        config = self._prepare_config(config)
        json_config = config.to_json()

        try:
            res = self.make_request("/start", timeout=60, config=json_config)
        except NodeAPIError as exc:
            if exc.detail == 'Xray is started already':
                return self.restart(config)
            else:
                raise exc

        self._started = True

        self._api = XRayAPI(
            address=self.address,
            port=self.api_port,
            ssl_cert=self._node_cert.encode(),
            ssl_target_name="Gozargah"
        )

        try:
            grpc.channel_ready_future(self._api._channel).result(timeout=35)
        except grpc.FutureTimeoutError:
            raise ConnectionError('Failed to connect to node\'s API')

        return res

    def stop(self):
        if not self.connected:
            self.connect()

        self.make_request('/stop', timeout=35)
        self._api = None
        self._started = False

    def restart(self, config: XRayConfig):
        if not self.connected:
            self.connect()

        config = self._prepare_config(config)
        json_config = config.to_json()

        res = self.make_request("/restart", timeout=60, config=json_config)

        self._started = True

        self._api = XRayAPI(
            address=self.address,
            port=self.api_port,
            ssl_cert=self._node_cert.encode(),
            ssl_target_name="Gozargah"
        )

        try:
            grpc.channel_ready_future(self._api._channel).result(timeout=35)
        except grpc.FutureTimeoutError:
            raise ConnectionError('Failed to connect to node\'s API')

        return res

    def _bg_fetch_logs(self):
        while self._logs_queues:
            try:
                websocket_url = f"{self._logs_ws_url}?session_id={self._session_id}&interval=0.7"
                ws = create_connection(websocket_url, sslopt={"context": self._ssl_context}, timeout=2)
                while self._logs_queues:
                    try:
                        logs = ws.recv()
                        for buf in self._logs_queues:
                            buf.append(logs)
                    except WebSocketConnectionClosedException:
                        break
                    except WebSocketTimeoutException:
                        pass
                    except Exception:
                        pass
            except Exception:
                pass
            time.sleep(2)

    @contextmanager
    def get_logs(self):
        try:
            buf = deque(maxlen=100)
            self._logs_queues.append(buf)

            if not self._logs_bg_thread.is_alive():
                try:
                    self._logs_bg_thread.start()
                except RuntimeError:
                    self._logs_bg_thread = threading.Thread(target=self._bg_fetch_logs, daemon=True)
                    self._logs_bg_thread.start()

            yield buf

        finally:
            try:
                self._logs_queues.remove(buf)
            except ValueError:
                pass
            del buf


class RPyCXRayNode:
    def __init__(self,
                 address: str,
                 port: int,
                 api_port: int,
                 ssl_key: str,
                 ssl_cert: str,
                 usage_coefficient: float = 1,
                 server_cert: Optional[str] = None):

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

        self._node_cert = None
        self._node_certfile = None
        if server_cert:
            self._pin_certificate(server_cert)

        self._service = Service()
        self._api = None

    def disconnect(self):
        try:
            self.connection.close()
            del self.connection
        except AttributeError:
            pass

    def _pin_certificate(self, pem: str) -> None:
        """Trust this certificate, and only this one, for the node."""
        self._node_cert = pem
        self._node_certfile = string_to_temp_file(pem)

    @property
    def server_cert(self) -> Optional[str]:
        """The certificate pinned for this node, if one has been established."""
        return self._node_cert

    def connect(self):
        self.disconnect()

        presented = ssl.get_server_certificate(
            (self.address, self.port), timeout=CERTIFICATE_FETCH_TIMEOUT
        )
        if self._node_cert is None:
            # Trust on first use; see ReSTXRayNode.connect.
            self._pin_certificate(presented)
        elif certificate_fingerprint(presented) != certificate_fingerprint(self._node_cert):
            raise NodeCertificateMismatch(
                expected=certificate_fingerprint(self._node_cert),
                presented=certificate_fingerprint(presented),
            )

        tries = 0
        while True:
            tries += 1
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


class XRayNode:
    def __new__(self,
                address: str,
                port: int,
                api_port: int,
                ssl_key: str,
                ssl_cert: str,
                usage_coefficient: float = 1,
                server_cert: Optional[str] = None):

        # trying to detect what's the server of node
        try:
            s = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
            s.settimeout(1)
            s.connect((address, port))
            s.send(b'HEAD / HTTP/1.0\r\n\r\n')
            s.recv(1024)
            s.close()
            # it might be uvicorn
            return ReSTXRayNode(
                address=address,
                port=port,
                api_port=api_port,
                ssl_key=ssl_key,
                ssl_cert=ssl_cert,
                usage_coefficient=usage_coefficient,
                server_cert=server_cert
            )
        except Exception:
            # if might be rpyc
            return RPyCXRayNode(
                address=address,
                port=port,
                api_port=api_port,
                ssl_key=ssl_key,
                ssl_cert=ssl_cert,
                usage_coefficient=usage_coefficient,
                server_cert=server_cert
            )

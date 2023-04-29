import rpyc
import logging
import grpc
from concurrent import futures
from threading import Thread
from rpyc.utils.authenticators import SSLAuthenticator
from rpyc.utils.server import ThreadedServer
from app import xray
from app.xray.core import XRayCore
from app.xray.config import XRayConfig
from xray_api import XRay
from xray_api.proto.app.stats.command import command_pb2_grpc

from config import (
    XRAY_EXECUTABLE_PATH,
    XRAY_ASSETS_PATH,
    SLAVE_SSL_CERTFILE,
    SLAVE_SSL_KEYFILE,
    SLAVE_PORT,
    SLAVE_API_PORT
)

class XRayAPI(XRay):
    def GetStats(self, request, context):
        stub = command_pb2_grpc.StatsServiceStub(self._channel)
        return stub.GetStats(request)

    def QueryStats(self, request, context):
        stub = command_pb2_grpc.StatsServiceStub(self._channel)
        return stub.QueryStats(request)

    def GetSysStats(self, request, context):
        stub = command_pb2_grpc.StatsServiceStub(self._channel)
        return stub.GetSysStats(request)

logger = logging.getLogger("slave")
logger.setLevel(logging.DEBUG)
ch = logging.StreamHandler()
ch.setFormatter(logging.Formatter("%(levelname)s: %(message)s"))
logger.addHandler(ch)

api_port = None
api = None

core = XRayCore(XRAY_EXECUTABLE_PATH, XRAY_ASSETS_PATH)

def start_stat():
    class RequestRpc(command_pb2_grpc.StatsServiceServicer):
        def GetStats(self, request, context):
            return api.GetStats(request, context)

        def QueryStats(self, request, context):
            return api.QueryStats(request, context)

        def GetSysStats(self, request, context):
            return api.GetSysStats(request, context)
        
    server = grpc.server(futures.ThreadPoolExecutor(max_workers=5))
    command_pb2_grpc.add_StatsServiceServicer_to_server(RequestRpc(), server)
    with open(SLAVE_SSL_KEYFILE, 'rb') as f:
        key = f.read()
    with open(SLAVE_SSL_CERTFILE, 'rb') as f:
        cert = f.read()
    server_credentials = grpc.ssl_server_credentials(((key, cert,),))
    server.add_secure_port(f'[::]:{SLAVE_API_PORT}', server_credentials)
    server.start()
    logger.info(f"stat started, listen on {SLAVE_API_PORT}")
    server.wait_for_termination()

def start_slave():
    @rpyc.service
    class SlaveService(rpyc.Service):
        @rpyc.exposed
        def start(self, config):
            if core.started:
                core.stop()

            config = XRayConfig(config)
            config.update_api_port(api_port)
            self.ouput_running_config(config)

            try:
                core.start(config)
                logger.info("start xray")
                return True, "xray started"
            except RuntimeError as err:
                logger.error(err)
                return False, err

        @rpyc.exposed
        def stop(self):
            core.stop()
            logger.info("stop xray")

        @rpyc.exposed
        def restart(self, config):
            config = XRayConfig(config)
            config.update_api_port(api_port)
            self.ouput_running_config(config)
            try:
                core.restart(config)
                logger.info("restart xray")
                return True, "xray restarted"
            except RuntimeError as err:
                logger.error(err)
                return False, err

        @rpyc.exposed
        def ouput_running_config(self, config: XRayConfig):
            with open("xray-running-custom.json", "w") as file:
                file.write(config.to_json())
                file.flush()
                file.close()

    logger.info(f"ssl keyfile: {SLAVE_SSL_KEYFILE}")
    logger.info(f"ssl certfile: {SLAVE_SSL_CERTFILE}")
    logger.info(f"slave started, listen on {SLAVE_PORT}")
    authenticator = SSLAuthenticator(SLAVE_SSL_KEYFILE, SLAVE_SSL_CERTFILE)
    slave = ThreadedServer(SlaveService, port = SLAVE_PORT, reuse_addr = True, authenticator = authenticator)
    slave.start()

def start():
    global api_port
    global api

    api_port = xray.config.api_port
    api = XRayAPI(xray.config.api_host, api_port)

    Thread(target=start_stat).start()
    start_slave()

__all__ = [
    "start"
]

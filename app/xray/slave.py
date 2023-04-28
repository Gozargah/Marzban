import rpyc
import logging
from rpyc.utils.authenticators import SSLAuthenticator
from rpyc.utils.server import ThreadedServer
from app.xray.core import XRayCore
from app.xray.config import XRayConfig

from config import (
    XRAY_EXECUTABLE_PATH,
    XRAY_ASSETS_PATH,
    SLAVE_SSL_CERTFILE,
    SLAVE_SSL_KEYFILE,
    SLAVE_PORT,
    SLAVE_API_PORT
)

logger = logging.getLogger("slave")
logger.setLevel(logging.DEBUG)
ch = logging.StreamHandler()
ch.setFormatter(logging.Formatter("%(levelname)s: %(message)s"))
logger.addHandler(ch)

core = XRayCore(XRAY_EXECUTABLE_PATH, XRAY_ASSETS_PATH)

@rpyc.service
class SlaveService(rpyc.Service):
    @rpyc.exposed
    def start(self, config):
        if core.started:
            core.stop()

        config = XRayConfig(config)
        config.update_api_port(SLAVE_API_PORT)
        self.ouput_running_config(config)

        try:
            core.start(config)
            logger.info("start slave")
            return True, "slave started"
        except RuntimeError as err:
            logger.error(err)
            return False, err

    @rpyc.exposed
    def stop(self):
        core.stop()
        logger.info("stop slave")

    @rpyc.exposed
    def restart(self, config):
        config = XRayConfig(config)
        config.update_api_port(SLAVE_API_PORT)
        self.ouput_running_config(config)
        try:
            core.restart(config)
            logger.info("restart slave")
            return True, "slave restarted"
        except RuntimeError as err:
            logger.error(err)
            return False, err

    @rpyc.exposed
    def ouput_running_config(self, config: XRayConfig):
        with open("xray-running-custom.json", "w") as file:
            file.write(config.to_json())
            file.flush()
            file.close()

def start():
    logger.info(f"slave start, listen on {SLAVE_PORT}")
    logger.info(f"ssl keyfile: {SLAVE_SSL_KEYFILE}")
    logger.info(f"ssl certfile: {SLAVE_SSL_CERTFILE}")
    authenticator = SSLAuthenticator(SLAVE_SSL_KEYFILE, SLAVE_SSL_CERTFILE)
    slave = ThreadedServer(SlaveService, port = SLAVE_PORT, reuse_addr = True, authenticator = authenticator)
    slave.start()

__all__ = [
    "start"
]

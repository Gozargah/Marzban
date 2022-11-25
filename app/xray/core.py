import subprocess

from app.xray.config import XRayConfig
from app import logger


class XRayCore:
    def __init__(self,
                 executable_path: str = "/usr/bin/xray",
                 assets_path: str = "/usr/share/xray"):
        self.executable_path = executable_path
        self.assets_path = assets_path
        self.started = False

        self._process = None
        self._env = {
            "XRAY_LOCATION_ASSET": assets_path
        }

    @property
    def process(self):
        if self._process is None:
            raise ProcessLookupError("Xray has not been started")
        return self._process

    def start(self, config: XRayConfig):
        if self.started is True:
            raise RuntimeError("Xray is started already")

        if config.get('log', {}).get('logLevel') in ('none', 'error'):
            config['log']['logLevel'] = 'warning'

        cmd = [
            self.executable_path,
            "run",
            '-config',
            'stdin:'
        ]
        self._process = subprocess.Popen(
            cmd,
            env=self._env,
            stdin=subprocess.PIPE,
            stdout=subprocess.PIPE
        )
        self._process.stdin.write(
            config.to_json().encode()
        )
        self._process.stdin.flush()
        self._process.stdin.close()

        # Wait for XRay to get started
        while log := self._process.stdout.readline().decode().strip('\n'):
            logger.debug(log)
            if 'core: Xray' in log and 'started' in log:
                logger.info(log)
                self.started = True
                break

        if not self.started:
            raise RuntimeError("Failed to run XRay", log)

    def stop(self):
        self.process.terminate()
        self.started = False
        self._process = None

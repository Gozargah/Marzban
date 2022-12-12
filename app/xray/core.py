import atexit
import subprocess

from app.xray.config import XRayConfig
from app import logger


class XRayCore:
    def __init__(self,
                 config: XRayConfig,
                 executable_path: str = "/usr/bin/xray",
                 assets_path: str = "/usr/share/xray"):
        self.executable_path = executable_path
        self.assets_path = assets_path
        self.started = False
        self.config = config
        self._process = None
        self._on_start_funcs = []
        self._on_stop_funcs = []
        self._env = {
            "XRAY_LOCATION_ASSET": assets_path
        }

        @atexit.register
        def stop_core():
            if self.started:
                self.stop()

    @property
    def process(self):
        if self._process is None:
            raise ProcessLookupError("Xray has not been started")
        return self._process

    def start(self):
        if self.started is True:
            raise RuntimeError("Xray is started already")

        if self.config.get('log', {}).get('logLevel') in ('none', 'error'):
            self.config['log']['logLevel'] = 'warning'

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
            self.config.to_json().encode()
        )
        self._process.stdin.flush()
        self._process.stdin.close()

        # Wait for XRay to get started
        while _ := self._process.stdout.readline().decode().strip('\n'):
            log = _
            logger.debug(log)
            if 'core: Xray' in log and 'started' in log:
                logger.info(log)
                self.started = True
                break

        if not self.started:
            raise RuntimeError("Failed to run XRay", log)

        # execute on start functions
        for func in self._on_start_funcs:
            func()

    def stop(self):
        self.process.terminate()
        self.started = False
        self._process = None
        logger.info("Xray stopped")

        # execute on stop functions
        for func in self._on_stop_funcs:
            func()

    def restart(self):
        self.stop()
        self.start()

    def on_start(self, func: callable):
        self._on_start_funcs.append(func)
        return func

    def on_stop(self, func: callable):
        self._on_stop_funcs.append(func)
        return func

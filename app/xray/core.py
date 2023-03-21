import atexit
import subprocess
import threading

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
        self._on_start_funcs = []
        self._on_stop_funcs = []
        self._env = {
            "XRAY_LOCATION_ASSET": assets_path
        }

        atexit.register(lambda: self.stop() if self.started else None)

    @property
    def process(self):
        if self._process is None:
            raise ProcessLookupError("Xray has not been started")
        return self._process

    def _read_process_stdout(self):
        def reader():
            while True:
                try:
                    output = self._process.stdout.readline().strip('\n')
                    if output == '' and self._process.poll() is not None:
                        break
                except AttributeError:
                    break

                # if output:
                #     logger.info(output)

        threading.Thread(target=reader).start()

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
            stdout=subprocess.PIPE,
            universal_newlines=True
        )
        self._process.stdin.write(config.to_json())
        self._process.stdin.flush()
        self._process.stdin.close()

        # Wait for XRay to get started
        log = ''
        while True:
            output = self._process.stdout.readline()
            if output == '' and self._process.poll() is not None:
                break

            if output:
                log = output.strip('\n')
                logger.debug(log)

                if log.endswith('started'):
                    logger.info(log)
                    self.started = True
                    break

        if not self.started:
            raise RuntimeError("Failed to run XRay", log)

        self._read_process_stdout()

        # execute on start functions
        for func in self._on_start_funcs:
            threading.Thread(target=func).start()

    def stop(self):
        self.process.terminate()
        self.started = False
        self._process = None
        logger.info("Xray stopped")

        # execute on stop functions
        for func in self._on_stop_funcs:
            threading.Thread(target=func).start()

    def restart(self, config: XRayConfig):
        self.stop()
        self.start(config)

    def on_start(self, func: callable):
        self._on_start_funcs.append(func)
        return func

    def on_stop(self, func: callable):
        self._on_stop_funcs.append(func)
        return func

import atexit
import json
import re
import subprocess
import threading
from collections import deque
from contextlib import contextmanager

from app import logger
from app.xray.config import XRayConfig
from config import DEBUG


class XRayCore:
    def __init__(self,
                 executable_path: str = "/usr/bin/xray",
                 assets_path: str = "/usr/share/xray"):
        self.executable_path = executable_path
        self.assets_path = assets_path

        self.version = self.get_version()
        self.process = None
        self.restarting = False

        self._logs_buffer = deque(maxlen=100)
        self._temp_log_buffers = {}
        self._on_start_funcs = []
        self._on_stop_funcs = []
        self._env = {
            "XRAY_LOCATION_ASSET": assets_path
        }

        atexit.register(lambda: self.stop() if self.started else None)

    def get_version(self):
        cmd = [self.executable_path, "version"]
        output = subprocess.check_output(cmd, stderr=subprocess.STDOUT).decode('utf-8')
        m = re.match(r'^Xray (\d+\.\d+\.\d+)', output)
        if m:
            return m.groups()[0]

    def get_x25519(self, private_key: str = None):
        cmd = [self.executable_path, "x25519"]
        if private_key:
            cmd.extend(['-i', private_key])
        output = subprocess.check_output(cmd, stderr=subprocess.STDOUT).decode('utf-8', errors='ignore')

        private, public = None, None
        stripped = output.strip()

        def _extract_from_obj(obj):
            nonlocal private, public
            if isinstance(obj, dict):
                for key, value in obj.items():
                    key_l = str(key).lower()
                    if isinstance(value, (dict, list)):
                        _extract_from_obj(value)
                        continue
                    if not isinstance(value, str):
                        continue
                    value = value.strip()
                    if not value:
                        continue
                    if 'private' in key_l and 'key' in key_l and not private:
                        private = value
                    elif 'public' in key_l and 'key' in key_l and not public:
                        public = value
            elif isinstance(obj, list):
                for item in obj:
                    _extract_from_obj(item)

        if stripped:
            try:
                parsed = json.loads(stripped)
            except (json.JSONDecodeError, ValueError):
                parsed = None
            if parsed is not None:
                _extract_from_obj(parsed)

        if not (private or public):
            pattern = re.compile(
                r'(?i)(private|public)[_\s-]*key(?:\s*\(\w+\))?\s*(?:[:=]\s*|\s+is\s+)?([A-Za-z0-9+/=_-]+)'
            )
            for key_type, value in pattern.findall(output):
                value = value.strip()
                if not value:
                    continue
                if key_type.lower().startswith('private') and not private:
                    private = value
                elif key_type.lower().startswith('public') and not public:
                    public = value

        if not (private or public):
            for line in output.splitlines():
                lower = line.lower()
                if 'key' not in lower:
                    continue
                match = re.search(r'([A-Za-z0-9+/=_-]{16,})', line)
                if not match:
                    continue
                value = match.group(1).strip()
                if not value:
                    continue
                if 'private' in lower and not private:
                    private = value
                elif 'public' in lower and not public:
                    public = value

        if private or public:
            result = {}
            if private:
                result["private_key"] = private
            if public:
                result["public_key"] = public
            return result

    def __capture_process_logs(self):
        def capture_and_debug_log():
            while self.process:
                output = self.process.stdout.readline()
                if output:
                    output = output.strip()
                    self._logs_buffer.append(output)
                    for buf in list(self._temp_log_buffers.values()):
                        buf.append(output)
                    logger.debug(output)

                elif not self.process or self.process.poll() is not None:
                    break

        def capture_only():
            while self.process:
                output = self.process.stdout.readline()
                if output:
                    output = output.strip()
                    self._logs_buffer.append(output)
                    for buf in list(self._temp_log_buffers.values()):
                        buf.append(output)

                elif not self.process or self.process.poll() is not None:
                    break

        if DEBUG:
            threading.Thread(target=capture_and_debug_log).start()
        else:
            threading.Thread(target=capture_only).start()

    @contextmanager
    def get_logs(self):
        buf = deque(self._logs_buffer, maxlen=100)
        buf_id = id(buf)
        try:
            self._temp_log_buffers[buf_id] = buf
            yield buf
        finally:
            del self._temp_log_buffers[buf_id]
            del buf

    @property
    def started(self):
        if not self.process:
            return False

        if self.process.poll() is None:
            return True

        return False

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
        self.process = subprocess.Popen(
            cmd,
            env=self._env,
            stdin=subprocess.PIPE,
            stderr=subprocess.PIPE,
            stdout=subprocess.PIPE,
            universal_newlines=True
        )
        self.process.stdin.write(config.to_json())
        self.process.stdin.flush()
        self.process.stdin.close()
        logger.warning(f"Xray core {self.version} started")

        self.__capture_process_logs()

        # execute on start functions
        for func in self._on_start_funcs:
            threading.Thread(target=func).start()

    def stop(self):
        if not self.started:
            return

        self.process.terminate()
        self.process = None
        logger.warning("Xray core stopped")

        # execute on stop functions
        for func in self._on_stop_funcs:
            threading.Thread(target=func).start()

    def restart(self, config: XRayConfig):
        if self.restarting is True:
            return

        try:
            self.restarting = True
            logger.warning("Restarting Xray core...")
            self.stop()
            self.start(config)
        finally:
            self.restarting = False

    def on_start(self, func: callable):
        self._on_start_funcs.append(func)
        return func

    def on_stop(self, func: callable):
        self._on_stop_funcs.append(func)
        return func

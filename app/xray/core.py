import asyncio
import atexit
import re
import subprocess
import threading
from collections import deque
from contextlib import contextmanager
from anyio import create_task_group, create_memory_object_stream, run, WouldBlock, ClosedResourceError, BrokenResourceError

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

        self._snd_stms, self._rcv_stms = [], []
        self._logs_buffer = deque(maxlen=100)
        self._on_start_funcs = []
        self._on_stop_funcs = []
        self._env = {
            "XRAY_LOCATION_ASSET": assets_path
        }

        atexit.register(lambda: self.stop() if self.started else None)

    async def aget_version(self):
        cmd = [self.executable_path, "version"]
        p = await asyncio.create_subprocess_shell(" ".join(cmd), stdout=asyncio.subprocess.PIPE, stderr=asyncio.subprocess.STDOUT)
        stdout = (await p.communicate())[0]
        return m.groups()[0] if (m := re.match(r'^Xray (\d+\.\d+\.\d+)', stdout.decode("utf-8"))) else None

    def get_version(self):
        return asyncio.get_event_loop().run_until_complete(self.aget_version())

    async def aget_x25519(self, private_key: str = None):
        cmd = [self.executable_path, "x25519"]
        if private_key:
            cmd.extend(['-i', private_key])
        p = await asyncio.create_subprocess_shell(" ".join(cmd), stdout=asyncio.subprocess.PIPE, stderr=asyncio.subprocess.STDOUT)
        stdout = (await p.communicate())[0]
        if m := re.match(r'Private key: (.+)\nPublic key: (.+)', stdout.decode()):
            private, public = m.groups()
            return {
                "private_key": private,
                "public_key": public
            }

    def get_x25519(self, private_key: str = None):
        # just calls the same function in a blocking way
        return asyncio.get_event_loop().run_until_complete(self.aget_x25519(private_key))

    async def __capture_process_logs(self):
        # capture the logs, push it into the stream, and store it in the deck
        # note that the stream blocks sending if it's full, so a deck is necessary
        try:
            while output := (await self.process.stdout.readline()):
                # self._logs_buffer.append(output)
                for stm in self._snd_stms:
                    try:
                        await stm.send(output)
                    except (ClosedResourceError, BrokenResourceError):
                        self._snd_stms.remove(stm)
                        continue
        except Exception as e:
            print(e, type(e), flush=True)

    async def get_logs_stm(self):
        new_snd_stm, new_rcv_stm = create_memory_object_stream()
        self._snd_stms.append(new_snd_stm)
        return new_rcv_stm

    def get_buffer(self):
        # makes a copy of the buffer, so it could be read multiple times
        # the buffer is never cleared in case logs from xray's exit are useful
        return self._logs_buffer.copy()

    @property
    def started(self):
        if not self.process:
            return False

        if self.process.returncode is None:
            return True

        return False

    async def start(self, config: XRayConfig):
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
        self.process = await asyncio.create_subprocess_shell(
            " ".join(cmd),
            env=self._env,
            stdin=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE,
            stdout=asyncio.subprocess.PIPE
        )
        self.process.stdin.write(str.encode(config.to_json()))
        await self.process.stdin.drain()
        self.process.stdin.close()
        await self.process.stdin.wait_closed()
        logger.warning(f"Xray core {self.version} started")

        asyncio.get_event_loop().create_task(self.__capture_process_logs())

    async def stop(self):
        if not self.started:
            return

        self.process.terminate()
        self.process = None
        logger.warning("Xray core stopped")

    async def restart(self, config: XRayConfig):
        if self.restarting is True:
            return

        try:
            self.restarting = True
            logger.warning("Restarting Xray core...")
            await self.stop()
            await self.start(config)
        finally:
            self.restarting = False

    def on_start(self, func: callable):
        self._on_start_funcs.append(func)
        return func

    def on_stop(self, func: callable):
        self._on_stop_funcs.append(func)
        return func

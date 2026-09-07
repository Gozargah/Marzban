import importlib.util
import io
import pathlib
import subprocess
import sys
import textwrap
import time
import types
import unittest
from unittest import mock


CORE_PATH = pathlib.Path(__file__).parents[1] / "app" / "xray" / "core.py"
REAL_POPEN = subprocess.Popen


def load_core_module():
    app_module = types.ModuleType("app")
    app_module.__path__ = []
    app_module.logger = mock.Mock()

    xray_module = types.ModuleType("app.xray")
    xray_module.__path__ = []

    xray_config_module = types.ModuleType("app.xray.config")
    xray_config_module.XRayConfig = object

    config_module = types.ModuleType("config")
    config_module.DEBUG = False

    module_name = "test_xray_core_module"
    spec = importlib.util.spec_from_file_location(module_name, CORE_PATH)
    module = importlib.util.module_from_spec(spec)
    dependencies = {
        "app": app_module,
        "app.xray": xray_module,
        "app.xray.config": xray_config_module,
        "config": config_module,
    }
    with mock.patch.dict(sys.modules, dependencies):
        spec.loader.exec_module(module)
    return module


class FakeConfig(dict):
    def to_json(self):
        return "{}"


class FakeProcess:
    def __init__(self, output):
        self.stdin = io.StringIO()
        self.stdout = io.StringIO(output)

    def poll(self):
        return 0 if self.stdout.tell() == len(self.stdout.getvalue()) else None

    def terminate(self):
        return None


class XRayCoreTests(unittest.TestCase):
    def make_core(self, core_module):
        with mock.patch.object(core_module.XRayCore, "get_version", return_value="test"):
            with mock.patch.object(core_module.atexit, "register"):
                return core_module.XRayCore()

    def start_with_tracked_threads(self, core_module, core, config, popen):
        threads = []
        real_thread = core_module.threading.Thread

        def track_thread(*args, **kwargs):
            thread = real_thread(*args, **kwargs)
            threads.append(thread)
            return thread

        with popen as popen_mock:
            with mock.patch.object(
                core_module.threading, "Thread", side_effect=track_thread
            ):
                core.start(config)
        return threads, popen_mock

    def close_process_streams(self, process):
        for name in ("stdin", "stdout", "stderr"):
            stream = getattr(process, name, None)
            if stream is not None and not stream.closed:
                stream.close()

    def test_start_merges_stderr_into_captured_output(self):
        core_module = load_core_module()
        process = FakeProcess("warning from xray stderr\n")
        process.stderr = None
        core = self.make_core(core_module)

        popen = mock.patch.object(
            core_module.subprocess, "Popen", return_value=process
        )
        threads, popen_mock = self.start_with_tracked_threads(
            core_module,
            core,
            FakeConfig(log={"logLevel": "warning"}),
            popen,
        )

        for _ in range(100):
            if core._logs_buffer:
                break
            time.sleep(0.01)

        for thread in threads:
            thread.join(timeout=5)
        try:
            self.assertTrue(all(not thread.is_alive() for thread in threads))
            self.assertEqual(popen_mock.call_args.kwargs["stderr"], subprocess.STDOUT)
            self.assertEqual(popen_mock.call_args.kwargs["stdout"], subprocess.PIPE)
            self.assertIn("warning from xray stderr", core._logs_buffer)
        finally:
            self.close_process_streams(process)

    def test_large_stderr_does_not_block_xray_process(self):
        core_module = load_core_module()
        child_code = textwrap.dedent(
            """
            import sys

            sys.stdin.read()
            for _ in range(2048):
                sys.stderr.write("x" * 1023 + "\\n")
            sys.stderr.write("stderr marker\\n")
            sys.stderr.flush()
            sys.stdout.write("stdout marker\\n")
            sys.stdout.flush()
            """
        )

        def launch_child(_cmd, **kwargs):
            return REAL_POPEN([sys.executable, "-c", child_code], **kwargs)

        core = self.make_core(core_module)
        popen = mock.patch.object(
            core_module.subprocess, "Popen", side_effect=launch_child
        )
        threads, _popen_mock = self.start_with_tracked_threads(
            core_module,
            core,
            FakeConfig(log={"logLevel": "warning"}),
            popen,
        )

        timed_out = False
        try:
            core.process.wait(timeout=10)
        except subprocess.TimeoutExpired:
            timed_out = True
            core.process.kill()
            core.process.wait(timeout=5)
        finally:
            if core.process.poll() is None:
                core.process.kill()
                core.process.wait(timeout=5)
            for thread in threads:
                thread.join(timeout=5)
            self.close_process_streams(core.process)

        self.assertFalse(timed_out, "Xray process blocked while writing stderr")
        self.assertTrue(all(not thread.is_alive() for thread in threads))
        self.assertIn("stderr marker", core._logs_buffer)
        self.assertIn("stdout marker", core._logs_buffer)


if __name__ == "__main__":
    unittest.main()

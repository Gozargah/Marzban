"""Raising resource limits, for the panel process and for the host.

The dangerous direction here is downwards: a hard limit can only ever fall for
the life of a process, so the tests care most that nothing this code does can
leave a limit lower than it found it.
"""

import json
import os
import resource

import pytest

from app.utils import limits
from app.utils.files import FileWriteError, atomic_write


@pytest.fixture
def host(tmp_path, monkeypatch):
    """Somewhere harmless to write the host's limit files."""
    for directory in ("security/limits.d", "systemd/system.conf.d", "docker"):
        (tmp_path / directory).mkdir(parents=True)

    paths = {
        "limits": tmp_path / "security/limits.d/99-xenith.conf",
        "systemd": tmp_path / "systemd/system.conf.d/99-xenith.conf",
        "docker": tmp_path / "docker/daemon.json",
    }
    monkeypatch.setattr(limits, "ULIMIT_ENABLED", True)
    monkeypatch.setattr(limits, "ULIMIT_LIMITS_CONF_PATH", str(paths["limits"]))
    monkeypatch.setattr(limits, "ULIMIT_SYSTEMD_CONF_PATH", str(paths["systemd"]))
    monkeypatch.setattr(limits, "ULIMIT_DOCKER_DAEMON_PATH", str(paths["docker"]))
    return paths


@pytest.fixture
def nofile():
    """Restore whatever this process was running under.

    Only the soft limit is ever moved here. Raising a hard limit needs
    CAP_SYS_RESOURCE, which a CI runner does not have, and lowering one cannot
    be undone for the life of the process.
    """
    before = resource.getrlimit(resource.RLIMIT_NOFILE)
    yield before
    resource.setrlimit(resource.RLIMIT_NOFILE, before)


@pytest.fixture
def reported_as(monkeypatch):
    """Report chosen rlimits without asking the kernel to apply them.

    The unlimited case cannot be set up for real without privilege, so it is
    stubbed at the boundary instead.
    """

    def stub(values):
        real = resource.getrlimit
        monkeypatch.setattr(
            limits.resource, "getrlimit", lambda which: values.get(which, real(which))
        )

    return stub


class TestAtomicWrite:
    def test_the_content_lands(self, tmp_path):
        path = tmp_path / "conf"
        atomic_write(str(path), "hello\n")

        assert path.read_text() == "hello\n"

    def test_an_existing_file_is_replaced_not_appended_to(self, tmp_path):
        path = tmp_path / "conf"
        atomic_write(str(path), "first\n")
        atomic_write(str(path), "second\n")

        assert path.read_text() == "second\n"

    def test_no_temporary_file_survives(self, tmp_path):
        atomic_write(str(tmp_path / "conf"), "hello\n")

        assert [p.name for p in tmp_path.iterdir()] == ["conf"]

    def test_the_mode_is_applied(self, tmp_path):
        path = tmp_path / "conf"
        atomic_write(str(path), "hello\n", mode=0o600)

        assert oct(path.stat().st_mode)[-3:] == "600"

    def test_a_missing_directory_is_reported(self, tmp_path):
        with pytest.raises(FileWriteError, match="does not exist"):
            atomic_write(str(tmp_path / "gone" / "conf"), "hello\n")


class TestTarget:
    def test_the_kernel_ceiling_caps_the_target(self, monkeypatch):
        monkeypatch.setattr(limits, "kernel_nr_open", lambda: 65536)
        monkeypatch.setattr(limits, "ULIMIT_TARGET_NOFILE", 1048576)

        assert limits.nofile_target() == 65536

    def test_the_configured_target_is_used_when_it_is_lower(self, monkeypatch):
        monkeypatch.setattr(limits, "kernel_nr_open", lambda: 1048576)
        monkeypatch.setattr(limits, "ULIMIT_TARGET_NOFILE", 65536)

        assert limits.nofile_target() == 65536

    def test_a_kernel_that_does_not_say_falls_back_to_the_setting(self, monkeypatch):
        monkeypatch.setattr(limits, "kernel_nr_open", lambda: None)
        monkeypatch.setattr(limits, "ULIMIT_TARGET_NOFILE", 4096)

        assert limits.nofile_target() == 4096


class TestReadLimits:
    def test_the_tracked_limits_are_reported(self):
        names = [limit.name for limit in limits.read_limits()]

        assert "nofile" in names

    def test_unlimited_reads_as_none_rather_than_a_huge_number(self, reported_as):
        reported_as({resource.RLIMIT_NOFILE: (1024, resource.RLIM_INFINITY)})

        reported = next(limit for limit in limits.read_limits() if limit.name == "nofile")

        assert reported.hard is None
        assert reported.soft == 1024

    def test_a_limit_below_the_target_is_not_at_target(self, nofile, monkeypatch):
        monkeypatch.setattr(limits, "kernel_nr_open", lambda: 65536)
        resource.setrlimit(resource.RLIMIT_NOFILE, (1024, nofile[1]))

        reported = next(limit for limit in limits.read_limits() if limit.name == "nofile")

        assert reported.at_target is False


class TestRaiseOwnLimits:
    def test_the_soft_limit_is_lifted(self, nofile, monkeypatch):
        monkeypatch.setattr(limits, "kernel_nr_open", lambda: 65536)
        resource.setrlimit(resource.RLIMIT_NOFILE, (1024, nofile[1]))

        report = limits.raise_own_limits()

        assert report.raised == ["nofile"]
        assert resource.getrlimit(resource.RLIMIT_NOFILE)[0] == 65536

    def test_a_limit_already_at_the_target_is_left_alone(self, nofile, monkeypatch):
        monkeypatch.setattr(limits, "kernel_nr_open", lambda: 1024)
        resource.setrlimit(resource.RLIMIT_NOFILE, (1024, nofile[1]))

        report = limits.raise_own_limits()

        assert report.raised == []
        assert "nofile" in report.unchanged

    def test_a_soft_limit_above_the_target_is_not_lowered(self, nofile, monkeypatch):
        monkeypatch.setattr(limits, "kernel_nr_open", lambda: 2048)
        resource.setrlimit(resource.RLIMIT_NOFILE, (4096, nofile[1]))

        limits.raise_own_limits()

        assert resource.getrlimit(resource.RLIMIT_NOFILE)[0] == 4096

    def test_no_hard_limit_is_ever_lowered(self, nofile, monkeypatch):
        monkeypatch.setattr(limits, "kernel_nr_open", lambda: 65536)
        resource.setrlimit(resource.RLIMIT_NOFILE, (1024, nofile[1]))
        before = {
            name: resource.getrlimit(getattr(resource, f"RLIMIT_{suffix}"))[1]
            for name, suffix in limits.TRACKED
        }

        limits.raise_own_limits()

        after = {
            name: resource.getrlimit(getattr(resource, f"RLIMIT_{suffix}"))[1]
            for name, suffix in limits.TRACKED
        }
        assert after == before

    def test_only_nofile_is_written_to(self, nofile):
        """nproc and memlock are reported but never set.

        A kernel may clamp what setrlimit is handed and drop the hard limit as
        a side effect, which cannot be undone for the life of the process.
        """
        report = limits.raise_own_limits()

        assert set(report.raised) <= {"nofile"}
        assert "nproc" in report.unchanged


class TestRenderedFiles:
    def test_the_limits_file_covers_root_explicitly(self, monkeypatch):
        monkeypatch.setattr(limits, "kernel_nr_open", lambda: 1048576)
        rendered = limits.limits_conf()

        # A `*` domain does not cover root, which is the usual reason a
        # limits.conf change looks like it did nothing.
        assert "root    soft    nofile  1048576" in rendered
        assert "*       hard    nofile  1048576" in rendered

    def test_the_systemd_file_sets_both_halves(self, monkeypatch):
        monkeypatch.setattr(limits, "kernel_nr_open", lambda: 65536)

        assert "DefaultLimitNOFILE=65536:65536" in limits.systemd_conf()

    def test_the_compose_snippet_is_valid_yaml(self, monkeypatch):
        import yaml

        monkeypatch.setattr(limits, "kernel_nr_open", lambda: 65536)
        parsed = yaml.safe_load(limits.compose_snippet())

        assert parsed["services"]["xenith"]["ulimits"]["nofile"] == {"soft": 65536, "hard": 65536}

    def test_the_docker_ulimits_use_the_daemon_shape(self, monkeypatch):
        monkeypatch.setattr(limits, "kernel_nr_open", lambda: 65536)

        assert limits.docker_ulimits() == {"nofile": {"Name": "nofile", "Hard": 65536, "Soft": 65536}}


class TestApplyHostLimits:
    def test_all_three_files_are_written(self, host, nofile):
        report = limits.apply_host_limits()

        assert set(report.written) == {str(path) for path in host.values()}
        assert all(path.exists() for path in host.values())

    def test_each_file_says_what_still_has_to_restart(self, host, nofile):
        report = limits.apply_host_limits()

        assert all(note for note in report.written.values())
        assert "restart docker" in report.written[str(host["docker"])]

    def test_a_new_daemon_json_holds_only_the_ulimits(self, host, nofile):
        limits.apply_host_limits()

        assert list(json.loads(host["docker"].read_text())) == ["default-ulimits"]

    def test_an_existing_daemon_json_keeps_its_other_settings(self, host, nofile):
        host["docker"].write_text(json.dumps({"log-driver": "journald", "iptables": False}))

        limits.apply_host_limits()

        parsed = json.loads(host["docker"].read_text())
        assert parsed["log-driver"] == "journald"
        assert parsed["iptables"] is False
        assert "nofile" in parsed["default-ulimits"]

    def test_other_default_ulimits_are_kept(self, host, nofile):
        host["docker"].write_text(
            json.dumps({"default-ulimits": {"nproc": {"Name": "nproc", "Hard": 64, "Soft": 64}}})
        )

        limits.apply_host_limits()

        parsed = json.loads(host["docker"].read_text())
        assert set(parsed["default-ulimits"]) == {"nproc", "nofile"}

    def test_a_broken_daemon_json_is_refused_rather_than_overwritten(self, host, nofile):
        host["docker"].write_text("{not json")

        with pytest.raises(limits.LimitsError, match="not valid JSON"):
            limits.apply_host_limits()

        assert host["docker"].read_text() == "{not json"

    def test_a_daemon_json_holding_a_list_is_refused(self, host, nofile):
        host["docker"].write_text("[]")

        with pytest.raises(limits.LimitsError, match="JSON object"):
            limits.apply_host_limits()

    def test_nothing_is_written_while_disabled(self, host, monkeypatch):
        monkeypatch.setattr(limits, "ULIMIT_ENABLED", False)

        with pytest.raises(limits.LimitsError, match="ULIMIT_ENABLED"):
            limits.apply_host_limits()

        assert not any(path.exists() for path in host.values())

    def test_a_missing_directory_is_reported_before_anything_is_written(self, host, monkeypatch):
        monkeypatch.setattr(limits, "ULIMIT_SYSTEMD_CONF_PATH", "/nonexistent/xenith.conf")

        with pytest.raises(limits.LimitsError, match="does not exist"):
            limits.apply_host_limits()

        assert not host["limits"].exists()

    def test_an_unwritable_directory_is_reported(self, host, monkeypatch, tmp_path):
        locked = tmp_path / "locked"
        locked.mkdir(mode=0o500)
        monkeypatch.setattr(limits, "ULIMIT_LIMITS_CONF_PATH", str(locked / "xenith.conf"))

        with pytest.raises(limits.LimitsError, match="not writable"):
            limits.apply_host_limits()

        os.chmod(locked, 0o700)

"""Reading and applying kernel tunables.

Everything here writes to the host's kernel, so the tests care most about the
boundary: which keys and values are allowed through, what the managed file
ends up containing, and what happens when the kernel refuses part of a set.
"""

import os
import subprocess

import pytest

from app.utils import sysctl
from app.utils.sysctl_catalog import BASELINE, BY_KEY, SECTIONS, TUNABLES


def failing_sysctl(monkeypatch, stderr, returncode=255):
    def fake_run(args, **kwargs):
        return subprocess.CompletedProcess(args, returncode, stdout="", stderr=stderr)

    monkeypatch.setattr(sysctl.subprocess, "run", fake_run)


class TestCatalogue:
    def test_every_key_appears_once(self):
        keys = [tunable.key for tunable in TUNABLES]

        assert len(keys) == len(set(keys))

    def test_every_tunable_lands_in_a_known_section(self):
        sections = dict(SECTIONS)

        assert all(tunable.section in sections for tunable in TUNABLES)

    def test_every_baseline_is_a_valid_value_for_its_own_key(self):
        for tunable in TUNABLES:
            assert sysctl.validate(tunable.key, tunable.baseline) == tunable.baseline

    def test_keys_map_onto_proc_paths(self):
        assert BY_KEY["net.ipv4.ip_forward"].proc_path == "net/ipv4/ip_forward"


class TestValidation:
    @pytest.mark.parametrize(
        "key, value",
        [
            ("vm.swappiness", "10"),
            ("net.ipv4.tcp_notsent_lowat", "0"),
            ("net.ipv4.tcp_rmem", "4096 87380 6291456"),
            ("kernel.printk", "4 4 1 7"),
            ("net.ipv4.tcp_congestion_control", "cubic"),
            ("net.core.default_qdisc", "fq_codel"),
        ],
    )
    def test_well_formed_values_pass(self, key, value):
        assert sysctl.validate(key, value) == value

    def test_surrounding_and_repeated_whitespace_is_normalised(self):
        assert sysctl.validate("net.ipv4.tcp_rmem", "  4096   87380\t6291456 ") == "4096 87380 6291456"

    def test_an_integer_is_accepted_as_well_as_a_string(self):
        assert sysctl.validate("vm.swappiness", 10) == "10"

    def test_a_key_outside_the_catalogue_is_refused(self):
        with pytest.raises(sysctl.SysctlError, match="not a setting this panel manages"):
            sysctl.validate("kernel.core_pattern", "|/bin/sh")

    @pytest.mark.parametrize(
        "value",
        [
            "10\nkernel.sysrq = 1",       # a second directive smuggled in
            "10 # comment",
            "",
            "   ",
            "ten",
            "1;2",
        ],
    )
    def test_a_malformed_integer_is_refused(self, value):
        with pytest.raises(sysctl.SysctlError):
            sysctl.validate("vm.swappiness", value)

    @pytest.mark.parametrize("value", ["fq; rm -rf /", "fq codel", "../../etc/passwd", "a" * 40])
    def test_a_malformed_name_is_refused(self, value):
        with pytest.raises(sysctl.SysctlError):
            sysctl.validate("net.core.default_qdisc", value)

    def test_a_list_where_a_single_value_belongs_is_refused(self):
        with pytest.raises(sysctl.SysctlError):
            sysctl.validate("vm.swappiness", "10 20")

    def test_none_is_refused(self):
        with pytest.raises(sysctl.SysctlError):
            sysctl.validate("vm.swappiness", None)

    def test_an_empty_set_is_refused(self):
        with pytest.raises(sysctl.SysctlError, match="No settings"):
            sysctl.validate_many({})

    def test_one_bad_key_rejects_the_whole_set(self):
        with pytest.raises(sysctl.SysctlError):
            sysctl.validate_many({"vm.swappiness": "10", "kernel.core_pattern": "|/bin/sh"})


class TestReading:
    def test_live_values_are_read_from_proc(self, proc):
        (proc / "vm/swappiness").write_text("60\n")

        assert sysctl.read_value(BY_KEY["vm.swappiness"]) == "60"

    def test_a_multi_value_key_is_collapsed_to_single_spaces(self, proc):
        (proc / "net/ipv4/tcp_rmem").write_text("4096\t87380   6291456\n")

        assert sysctl.read_value(BY_KEY["net.ipv4.tcp_rmem"]) == "4096 87380 6291456"

    def test_a_key_the_kernel_does_not_expose_reads_as_none(self, proc):
        os.remove(proc / "net/netfilter/nf_conntrack_max")

        assert sysctl.read_value(BY_KEY["net.netfilter.nf_conntrack_max"]) is None

    def test_every_key_is_reported(self, proc):
        assert set(sysctl.read_values()) == set(BY_KEY)

    def test_a_missing_key_falls_back_to_the_managed_file(self, proc, conf):
        os.remove(proc / "net/netfilter/nf_conntrack_max")
        conf.write_text("net.netfilter.nf_conntrack_max = 999\n")

        assert sysctl.effective_values()["net.netfilter.nf_conntrack_max"] == "999"

    def test_and_then_to_the_baseline(self, proc, conf):
        os.remove(proc / "net/netfilter/nf_conntrack_max")

        expected = BASELINE["net.netfilter.nf_conntrack_max"]
        assert sysctl.effective_values()["net.netfilter.nf_conntrack_max"] == expected

    def test_the_live_value_wins_over_the_file(self, proc, conf):
        (proc / "vm/swappiness").write_text("60\n")
        conf.write_text("vm.swappiness = 10\n")

        assert sysctl.effective_values()["vm.swappiness"] == "60"

    def test_unknown_keys_in_the_managed_file_are_ignored(self, conf):
        conf.write_text("kernel.core_pattern = |/bin/sh\nvm.swappiness = 10\n")

        assert sysctl.managed_values() == {"vm.swappiness": "10"}

    def test_comments_in_the_managed_file_are_ignored(self, conf):
        conf.write_text("# a comment\nvm.swappiness = 10  # trailing\n")

        assert sysctl.managed_values() == {"vm.swappiness": "10"}

    def test_no_managed_file_yet_is_not_an_error(self, conf):
        assert sysctl.managed_values() == {}


class TestRendering:
    def test_values_are_grouped_under_their_section(self):
        rendered = sysctl.render({"vm.swappiness": "10", "net.ipv4.ip_forward": "1"})

        assert "# Memory\nvm.swappiness = 10" in rendered
        assert "# Routing and forwarding\nnet.ipv4.ip_forward = 1" in rendered

    def test_the_file_says_who_owns_it(self):
        assert sysctl.render({"vm.swappiness": "10"}).startswith("# Managed by Xenith")

    def test_empty_sections_are_left_out(self):
        assert "ICMP" not in sysctl.render({"vm.swappiness": "10"})

    def test_the_whole_baseline_renders(self):
        rendered = sysctl.render(dict(BASELINE))

        assert all(f"{key} = {value}" in rendered for key, value in BASELINE.items())


class TestWritable:
    def test_disabled_says_which_setting_turns_it_on(self, monkeypatch):
        monkeypatch.setattr(sysctl, "SYSCTL_ENABLED", False)
        allowed, reason = sysctl.writable()

        assert allowed is False
        assert "SYSCTL_ENABLED" in reason

    def test_a_missing_proc_is_reported(self, enabled, monkeypatch, tmp_path):
        monkeypatch.setattr(sysctl, "SYSCTL_PROC_PATH", str(tmp_path / "gone"))
        allowed, reason = sysctl.writable()

        assert allowed is False
        assert "not available" in reason

    def test_a_read_only_proc_is_reported(self, enabled, proc, conf):
        os.chmod(proc / "net/ipv4/ip_forward", 0o444)
        allowed, reason = sysctl.writable()

        assert allowed is False
        assert "read-only" in reason

    def test_a_missing_sysctl_directory_is_reported(self, enabled, proc, monkeypatch, tmp_path):
        monkeypatch.setattr(sysctl, "SYSCTL_CONF_PATH", str(tmp_path / "gone" / "99-xenith.conf"))
        allowed, reason = sysctl.writable()

        assert allowed is False
        assert "does not exist" in reason

    def test_everything_in_place_is_writable(self, enabled, proc, conf):
        assert sysctl.writable() == (True, None)


class TestApply:
    def test_the_values_reach_the_managed_file(self, enabled, proc, conf, sysctl_runs):
        sysctl.apply({"vm.swappiness": "1"})

        assert "vm.swappiness = 1" in conf.read_text()

    def test_the_file_is_loaded_by_itself_not_the_whole_directory(self, enabled, proc, conf, sysctl_runs):
        """`sysctl --system` would re-apply other files over ours; -p does not."""
        sysctl.apply({"vm.swappiness": "1"})

        assert sysctl_runs == [["sysctl", "-p", str(conf)]]

    def test_the_applied_values_are_reported_back(self, enabled, proc, conf, sysctl_runs):
        result = sysctl.apply({"vm.swappiness": "1", "net.ipv4.ip_forward": "0"})

        assert result.applied == {"vm.swappiness": "1", "net.ipv4.ip_forward": "0"}
        assert result.failed == []

    def test_a_previous_file_is_replaced_rather_than_appended_to(self, enabled, proc, conf, sysctl_runs):
        sysctl.apply({"vm.swappiness": "1"})
        sysctl.apply({"vm.swappiness": "2"})

        assert conf.read_text().count("vm.swappiness") == 1
        assert "vm.swappiness = 2" in conf.read_text()

    def test_no_temporary_file_is_left_behind(self, enabled, proc, conf, sysctl_runs):
        sysctl.apply({"vm.swappiness": "1"})

        assert [p.name for p in conf.parent.iterdir()] == [conf.name]

    def test_the_file_is_world_readable(self, enabled, proc, conf, sysctl_runs):
        sysctl.apply({"vm.swappiness": "1"})

        assert oct(conf.stat().st_mode)[-3:] == "644"

    def test_a_refused_key_is_reported_and_the_rest_still_count(self, enabled, proc, conf, monkeypatch):
        failing_sysctl(
            monkeypatch,
            'sysctl: setting key "net.netfilter.nf_conntrack_max": Read-only file system\n',
        )

        result = sysctl.apply({"vm.swappiness": "1", "net.netfilter.nf_conntrack_max": "999"})

        assert result.applied == {"vm.swappiness": "1"}
        assert result.failed == [("net.netfilter.nf_conntrack_max", "Read-only file system")]

    def test_several_refusals_are_all_reported(self, enabled, proc, conf, monkeypatch):
        failing_sysctl(
            monkeypatch,
            'sysctl: setting key "vm.swappiness": Permission denied\n'
            'sysctl: setting key "kernel.sysrq": Permission denied\n',
        )

        result = sysctl.apply({"vm.swappiness": "1", "kernel.sysrq": "0"})

        assert [key for key, _ in result.failed] == ["vm.swappiness", "kernel.sysrq"]
        assert result.applied == {}

    def test_a_failure_with_no_key_named_raises(self, enabled, proc, conf, monkeypatch):
        failing_sysctl(monkeypatch, "sysctl: cannot stat /proc/sys: No such file or directory\n")

        with pytest.raises(sysctl.SysctlError, match="cannot stat"):
            sysctl.apply({"vm.swappiness": "1"})

    def test_a_missing_binary_is_reported_plainly(self, enabled, proc, conf, monkeypatch):
        def missing(*args, **kwargs):
            raise FileNotFoundError

        monkeypatch.setattr(sysctl.subprocess, "run", missing)

        with pytest.raises(sysctl.SysctlError, match="was not found"):
            sysctl.apply({"vm.swappiness": "1"})

    def test_a_hanging_sysctl_is_reported_plainly(self, enabled, proc, conf, monkeypatch):
        def hang(*args, **kwargs):
            raise subprocess.TimeoutExpired(cmd="sysctl", timeout=30)

        monkeypatch.setattr(sysctl.subprocess, "run", hang)

        with pytest.raises(sysctl.SysctlError, match="did not finish"):
            sysctl.apply({"vm.swappiness": "1"})

    def test_nothing_is_written_while_disabled(self, proc, conf, sysctl_runs):
        with pytest.raises(sysctl.SysctlError, match="SYSCTL_ENABLED"):
            sysctl.apply({"vm.swappiness": "1"})

        assert not conf.exists()
        assert sysctl_runs == []

    def test_nothing_is_written_when_a_value_is_invalid(self, enabled, proc, conf, sysctl_runs):
        with pytest.raises(sysctl.SysctlError):
            sysctl.apply({"vm.swappiness": "10", "kernel.core_pattern": "|/bin/sh"})

        assert not conf.exists()
        assert sysctl_runs == []

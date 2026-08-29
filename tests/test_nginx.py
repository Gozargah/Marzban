"""Managing nginx: site files, uploaded pages and logs.

Most of what matters here is refusal. The panel writes into /etc/nginx and a
web root, both from names a browser supplied, so the tests spend their weight
on what must never be written and on the rollback that keeps a bad config from
reaching a reload.
"""

import os

import pytest

from app.utils import nginx

SITE = "server {\n    listen 80;\n    server_name example.com;\n}\n"


@pytest.fixture
def site(nginx_host):
    (nginx_host["sites_available"] / "panel").write_text(SITE)
    return nginx_host


class TestSiteNames:
    @pytest.mark.parametrize("name", ["panel", "example.com", "a_b-c.conf", "x"])
    def test_ordinary_names_pass(self, name):
        assert nginx.validate_site_name(name) == name

    @pytest.mark.parametrize(
        "name",
        [
            "../evil",
            "/etc/passwd",
            "a/b",
            "..",
            ".hidden",
            "",
            "   ",
            "a" * 65,
            "sp ace",
            "semi;colon",
        ],
    )
    def test_anything_that_could_leave_the_directory_is_refused(self, name):
        with pytest.raises(nginx.NginxError):
            nginx.validate_site_name(name)


class TestAssetPaths:
    @pytest.mark.parametrize(
        "path, expected",
        [
            ("index.html", "index.html"),
            ("/index.html", "index.html"),
            ("assets/logo.svg", "assets/logo.svg"),
            ("a/b/c/style.css", "a/b/c/style.css"),
            ("fonts\\inter.woff2", "fonts/inter.woff2"),
        ],
    )
    def test_ordinary_paths_are_normalised(self, path, expected):
        assert nginx.validate_asset_path(path) == expected

    @pytest.mark.parametrize(
        "path",
        ["../../etc/passwd", "a/../../b.html", "..%2f..%2fx.html", "./../x.html", "a/./b.html"],
    )
    def test_traversal_is_refused(self, path):
        with pytest.raises(nginx.NginxError):
            nginx.validate_asset_path(path)

    @pytest.mark.parametrize("path", ["shell.php", "run.sh", "a.py", "noextension", "x.PHP"])
    def test_anything_executable_is_refused(self, path):
        with pytest.raises(nginx.NginxError):
            nginx.validate_asset_path(path)

    def test_an_empty_path_is_refused(self):
        with pytest.raises(nginx.NginxError, match="required"):
            nginx.validate_asset_path("   ")

    def test_a_deeply_nested_path_is_refused(self):
        with pytest.raises(nginx.NginxError, match="nested too deeply"):
            nginx.validate_asset_path("/".join(["a"] * 9) + "/x.html")

    def test_the_extension_check_is_case_insensitive(self):
        assert nginx.validate_asset_path("Logo.PNG") == "Logo.PNG"


class TestDisabled:
    @pytest.mark.parametrize(
        "call",
        [
            lambda: nginx.list_sites(),
            lambda: nginx.read_site("panel"),
            lambda: nginx.write_site("panel", SITE),
            lambda: nginx.enable_site("panel"),
            lambda: nginx.remove_site("panel"),
            lambda: nginx.list_assets(),
            lambda: nginx.write_asset("x.html", b"hi"),
            lambda: nginx.read_log("error"),
            lambda: nginx.reload(),
        ],
    )
    def test_everything_refuses_until_it_is_turned_on(self, call):
        with pytest.raises(nginx.NginxError, match="NGINX_ENABLED"):
            call()


class TestSites:
    def test_sites_are_listed_with_their_state(self, site):
        listed = nginx.list_sites()

        assert [s.name for s in listed] == ["panel"]
        assert listed[0].enabled is False
        assert listed[0].size == len(SITE)

    def test_enabling_links_it_into_sites_enabled(self, site):
        nginx.enable_site("panel")

        link = site["sites_enabled"] / "panel"
        assert link.is_symlink()
        assert nginx.list_sites()[0].enabled is True

    def test_enabling_twice_is_not_an_error(self, site):
        nginx.enable_site("panel")
        nginx.enable_site("panel")

        assert nginx.list_sites()[0].enabled is True

    def test_disabling_removes_the_link_but_keeps_the_file(self, site):
        nginx.enable_site("panel")
        nginx.disable_site("panel")

        assert not (site["sites_enabled"] / "panel").exists()
        assert (site["sites_available"] / "panel").exists()

    def test_disabling_something_already_off_is_not_an_error(self, site):
        nginx.disable_site("panel")

    def test_enabling_a_site_that_does_not_exist_is_refused(self, nginx_host):
        with pytest.raises(nginx.NginxError, match="No site"):
            nginx.enable_site("ghost")

    def test_deleting_takes_the_link_with_it(self, site):
        nginx.enable_site("panel")

        nginx.remove_site("panel")

        assert not (site["sites_available"] / "panel").exists()
        assert not (site["sites_enabled"] / "panel").exists()

    def test_deleting_something_that_is_not_there_is_refused(self, nginx_host):
        with pytest.raises(nginx.NginxError, match="No site"):
            nginx.remove_site("ghost")

    def test_reading_a_site_returns_it_verbatim(self, site):
        assert nginx.read_site("panel") == SITE

    def test_reading_a_missing_site_is_refused(self, nginx_host):
        with pytest.raises(nginx.NginxError, match="No site"):
            nginx.read_site("ghost")

    def test_a_missing_sites_directory_is_reported_plainly(self, nginx_host, monkeypatch):
        monkeypatch.setattr(nginx, "NGINX_SITES_AVAILABLE", "/nonexistent")

        with pytest.raises(nginx.NginxError, match="does not exist"):
            nginx.list_sites()


class TestWriteSite:
    def test_an_accepted_config_is_kept(self, site, nginx_runs):
        nginx.write_site("panel", "server { listen 8080; }\n")

        assert (site["sites_available"] / "panel").read_text() == "server { listen 8080; }\n"

    def test_a_new_site_can_be_created(self, nginx_host, nginx_runs):
        nginx.write_site("fresh", SITE)

        assert (nginx_host["sites_available"] / "fresh").read_text() == SITE

    def test_a_rejected_config_is_rolled_back(self, site, nginx_runs):
        nginx_runs.outcome.update(returncode=1, stderr="nginx: [emerg] unknown directive\n")

        with pytest.raises(nginx.NginxError, match="rolled back"):
            nginx.write_site("panel", "nonsense\n")

        assert (site["sites_available"] / "panel").read_text() == SITE

    def test_a_rejected_new_site_leaves_no_file_behind(self, nginx_host, nginx_runs):
        nginx_runs.outcome.update(returncode=1, stderr="nginx: [emerg] unknown directive\n")

        with pytest.raises(nginx.NginxError):
            nginx.write_site("fresh", "nonsense\n")

        assert not (nginx_host["sites_available"] / "fresh").exists()

    def test_the_check_runs_after_the_write_not_before(self, site, nginx_runs):
        """nginx -t reads what is on disk, so the order is the whole mechanism."""
        nginx.write_site("panel", "server { listen 8080; }\n")

        assert [call[1] for call in nginx_runs] == ["-t"]


class TestReload:
    def test_a_valid_config_is_reloaded(self, nginx_host, nginx_runs):
        nginx.reload()

        assert [call[1:] for call in nginx_runs] == [["-t"], ["-s", "reload"]]

    def test_a_broken_config_is_never_reloaded(self, nginx_host, nginx_runs):
        """`nginx -s reload` reports success on a bad config, so it must not run."""
        nginx_runs.outcome.update(returncode=1, stderr="nginx: [emerg] unknown directive\n")

        with pytest.raises(nginx.NginxError, match="not valid"):
            nginx.reload()

        assert [call[1] for call in nginx_runs] == ["-t"]

    def test_a_missing_binary_is_reported_plainly(self, nginx_host, monkeypatch):
        def missing(*args, **kwargs):
            raise FileNotFoundError

        monkeypatch.setattr(nginx.subprocess, "run", missing)

        with pytest.raises(nginx.NginxError, match="was not found"):
            nginx.reload()


class TestStatus:
    def test_the_version_is_read_off_the_banner(self, nginx_host, nginx_runs):
        assert nginx.version() == "1.24.0"

    def test_listening_ports_come_from_the_dumped_config(self, nginx_host, nginx_runs):
        assert nginx.listening_ports() == [80, 443]

    def test_status_reports_disabled_without_asking_nginx(self, monkeypatch):
        monkeypatch.setattr(nginx, "NGINX_ENABLED", False)

        state = nginx.status()

        assert state.running is False
        assert "disabled" in state.message

    def test_status_survives_a_missing_binary(self, nginx_host, monkeypatch):
        def missing(*args, **kwargs):
            raise FileNotFoundError

        monkeypatch.setattr(nginx.subprocess, "run", missing)

        state = nginx.status()

        assert state.running is False
        assert "was not found" in state.message


class TestWebroot:
    def test_a_file_is_written_and_listed(self, nginx_host):
        nginx.write_asset("index.html", b"<h1>hi</h1>")

        assert [asset.path for asset in nginx.list_assets()] == ["index.html"]
        assert (nginx_host["webroot"] / "index.html").read_text() == "<h1>hi</h1>"

    def test_nested_directories_are_created(self, nginx_host):
        nginx.write_asset("assets/css/site.css", b"body{}")

        assert (nginx_host["webroot"] / "assets/css/site.css").exists()

    def test_binary_content_survives_the_round_trip(self, nginx_host):
        """A font written as text would come back corrupted."""
        payload = bytes(range(256))

        nginx.write_asset("fonts/inter.woff2", payload)

        assert (nginx_host["webroot"] / "fonts/inter.woff2").read_bytes() == payload

    def test_a_file_can_be_read_back_as_text(self, nginx_host):
        nginx.write_asset("index.html", b"<h1>hi</h1>")

        assert nginx.read_asset("index.html") == "<h1>hi</h1>"

    def test_a_file_can_be_deleted(self, nginx_host):
        nginx.write_asset("index.html", b"hi")

        nginx.remove_asset("index.html")

        assert nginx.list_assets() == []

    def test_deleting_something_absent_is_refused(self, nginx_host):
        with pytest.raises(nginx.NginxError, match="No file"):
            nginx.remove_asset("ghost.html")

    def test_a_file_larger_than_the_cap_is_refused(self, nginx_host, monkeypatch):
        monkeypatch.setattr(nginx, "NGINX_MAX_UPLOAD_BYTES", 10)

        with pytest.raises(nginx.NginxError, match="larger than"):
            nginx.write_asset("index.html", b"x" * 11)

    def test_nothing_can_be_written_outside_the_root(self, nginx_host, tmp_path):
        with pytest.raises(nginx.NginxError):
            nginx.write_asset("../escaped.html", b"nope")

        assert not (tmp_path / "escaped.html").exists()

    def test_a_symlink_out_of_the_root_cannot_be_written_through(self, nginx_host, tmp_path):
        """The name is clean, so only resolving the path catches this one."""
        outside = tmp_path / "outside"
        outside.mkdir()
        os.symlink(outside, nginx_host["webroot"] / "link")

        with pytest.raises(nginx.NginxError, match="outside the web root"):
            nginx.write_asset("link/evil.html", b"nope")

        assert not (outside / "evil.html").exists()

    def test_symlinks_are_left_out_of_the_listing(self, nginx_host, tmp_path):
        target = tmp_path / "secret.html"
        target.write_text("secret")
        os.symlink(target, nginx_host["webroot"] / "secret.html")

        assert nginx.list_assets() == []

    def test_usage_counts_what_is_there(self, nginx_host):
        nginx.write_asset("a.html", b"12345")
        nginx.write_asset("b.html", b"123")

        assert nginx.webroot_usage() == (8, 2)


class TestLogs:
    def test_the_tail_is_returned(self, nginx_host):
        (nginx_host["logs"] / "error.log").write_text("\n".join(f"line {i}" for i in range(500)))

        tail = nginx.read_log("error", lines=10)

        assert tail.splitlines()[-1] == "line 499"
        assert len(tail.splitlines()) == 10

    def test_a_short_log_is_returned_whole(self, nginx_host):
        (nginx_host["logs"] / "access.log").write_text("one\ntwo\n")

        assert nginx.read_log("access", lines=100).splitlines() == ["one", "two"]

    def test_a_log_that_does_not_exist_yet_is_reported_plainly(self, nginx_host):
        with pytest.raises(nginx.NginxError, match="does not exist"):
            nginx.read_log("error")

    def test_only_the_two_known_logs_can_be_read(self, nginx_host):
        with pytest.raises(nginx.NginxError, match="not a log"):
            nginx.read_log("../../etc/passwd")

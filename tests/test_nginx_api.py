"""The /api/nginx endpoints.

The whole screen is sudo-only and inert until the panel is configured for it.
Beyond that, the tests care about the same thing the utility does: that a name
supplied by a browser cannot reach a file it should not, and that a config the
server rejects never survives the request.
"""

import io
import os

import pytest

from conftest import auth

SITE = "server {\n    listen 80;\n}\n"


@pytest.fixture
def site(nginx_host):
    (nginx_host["sites_available"] / "panel").write_text(SITE)
    return nginx_host


class TestAuthorisation:
    ENDPOINTS = [
        ("get", "/api/nginx"),
        ("post", "/api/nginx/test"),
        ("post", "/api/nginx/reload"),
        ("get", "/api/nginx/sites"),
        ("get", "/api/nginx/sites/panel"),
        ("put", "/api/nginx/sites/panel"),
        ("post", "/api/nginx/sites/panel/enable"),
        ("post", "/api/nginx/sites/panel/disable"),
        ("delete", "/api/nginx/sites/panel"),
        ("get", "/api/nginx/files"),
        ("get", "/api/nginx/logs/error"),
    ]

    @staticmethod
    def call(client, method, path, **kwargs):
        if method not in ("get", "delete"):
            kwargs["json"] = {"content": ""}
        return getattr(client, method)(path, **kwargs)

    @pytest.mark.parametrize("method, path", ENDPOINTS)
    def test_no_credentials_is_rejected(self, client, method, path):
        assert self.call(client, method, path).status_code == 401

    @pytest.mark.parametrize("method, path", ENDPOINTS)
    def test_a_reseller_is_rejected(self, client, plain_admin, method, path):
        assert self.call(client, method, path, headers=auth(plain_admin)).status_code == 403


class TestStatus:
    def test_disabled_is_reported_rather_than_failing(self, client, sudo_admin):
        body = client.get("/api/nginx", headers=auth(sudo_admin)).json()

        assert body["enabled"] is False
        assert body["running"] is False

    def test_the_paths_are_reported_so_the_screen_can_name_them(self, client, sudo_admin):
        body = client.get("/api/nginx", headers=auth(sudo_admin)).json()

        assert set(body["paths"]) == {
            "conf_dir", "sites_available", "sites_enabled", "webroot", "log_dir"
        }

    def test_a_configured_host_reports_version_and_ports(self, client, sudo_admin, nginx_host, nginx_runs):
        body = client.get("/api/nginx", headers=auth(sudo_admin)).json()

        assert body["enabled"] is True
        assert body["version"] == "1.24.0"
        assert body["config_ok"] is True
        assert body["listening"] == [80, 443]

    def test_a_failing_check_is_reported_with_what_nginx_said(
        self, client, sudo_admin, nginx_host, nginx_runs
    ):
        nginx_runs.outcome.update(returncode=1, stderr="nginx: [emerg] unknown directive\n")

        body = client.post("/api/nginx/test", headers=auth(sudo_admin)).json()

        assert body["status"]["config_ok"] is False
        assert "unknown directive" in body["detail"]

    def test_reload_refuses_while_the_config_is_broken(self, client, sudo_admin, nginx_host, nginx_runs):
        nginx_runs.outcome.update(returncode=1, stderr="nginx: [emerg] unknown directive\n")

        response = client.post("/api/nginx/reload", headers=auth(sudo_admin))

        assert response.status_code == 400
        assert "not valid" in response.json()["detail"]

    def test_reload_runs_when_the_config_is_good(self, client, sudo_admin, nginx_host, nginx_runs):
        assert client.post("/api/nginx/reload", headers=auth(sudo_admin)).status_code == 200
        assert ["-s", "reload"] in [call[1:] for call in nginx_runs]


class TestSites:
    def test_sites_are_listed(self, client, sudo_admin, site):
        body = client.get("/api/nginx/sites", headers=auth(sudo_admin)).json()

        assert [entry["name"] for entry in body] == ["panel"]
        assert body[0]["enabled"] is False

    def test_a_site_is_returned_verbatim(self, client, sudo_admin, site):
        body = client.get("/api/nginx/sites/panel", headers=auth(sudo_admin)).json()

        assert body["content"] == SITE

    def test_a_missing_site_is_a_400(self, client, sudo_admin, nginx_host):
        assert client.get("/api/nginx/sites/ghost", headers=auth(sudo_admin)).status_code == 400

    @pytest.mark.parametrize("name", [".hidden", "a b", "%2e%2e", "%2e%2e%2f%2e%2e%2fpasswd"])
    def test_a_name_that_could_escape_never_reaches_the_filesystem(
        self, client, sudo_admin, nginx_host, name
    ):
        response = client.get(f"/api/nginx/sites/{name}", headers=auth(sudo_admin))

        assert response.status_code in (400, 404, 422)

    def test_a_bare_dot_dot_is_collapsed_before_it_is_ever_sent(
        self, client, sudo_admin, nginx_host
    ):
        """`/sites/..` collapses to `/api/nginx`, which is the status endpoint.

        Worth pinning down: it looks like a traversal that returned 200, and
        the reason it is harmless is that the handler never saw the `..`.
        """
        response = client.get("/api/nginx/sites/..", headers=auth(sudo_admin))

        assert response.status_code == 200
        assert "paths" in response.json()

    def test_a_site_is_written(self, client, sudo_admin, site, nginx_runs):
        response = client.put(
            "/api/nginx/sites/panel",
            json={"content": "server { listen 8080; }\n"},
            headers=auth(sudo_admin),
        )

        assert response.status_code == 200
        assert (site["sites_available"] / "panel").read_text() == "server { listen 8080; }\n"

    def test_a_rejected_write_is_a_400_and_leaves_the_file_alone(
        self, client, sudo_admin, site, nginx_runs
    ):
        nginx_runs.outcome.update(returncode=1, stderr="nginx: [emerg] unknown directive\n")

        response = client.put(
            "/api/nginx/sites/panel", json={"content": "nonsense\n"}, headers=auth(sudo_admin)
        )

        assert response.status_code == 400
        assert (site["sites_available"] / "panel").read_text() == SITE

    def test_a_site_is_enabled_and_disabled(self, client, sudo_admin, site, nginx_runs):
        client.post("/api/nginx/sites/panel/enable", headers=auth(sudo_admin))
        assert (site["sites_enabled"] / "panel").is_symlink()

        client.post("/api/nginx/sites/panel/disable", headers=auth(sudo_admin))
        assert not (site["sites_enabled"] / "panel").exists()

    def test_a_site_is_deleted(self, client, sudo_admin, site, nginx_runs):
        assert client.delete("/api/nginx/sites/panel", headers=auth(sudo_admin)).status_code == 200
        assert not (site["sites_available"] / "panel").exists()


class TestFiles:
    def test_the_web_root_is_listed(self, client, sudo_admin, nginx_host):
        (nginx_host["webroot"] / "index.html").write_text("<h1>hi</h1>")

        body = client.get("/api/nginx/files", headers=auth(sudo_admin)).json()

        assert [asset["path"] for asset in body["assets"]] == ["index.html"]
        assert body["total_bytes"] == 11

    def test_a_page_is_uploaded(self, client, sudo_admin, nginx_host):
        response = client.post(
            "/api/nginx/files/upload",
            files={"file": ("index.html", io.BytesIO(b"<h1>maintenance</h1>"), "text/html")},
            headers=auth(sudo_admin),
        )

        assert response.status_code == 200
        assert (nginx_host["webroot"] / "index.html").read_text() == "<h1>maintenance</h1>"

    def test_the_destination_can_be_chosen(self, client, sudo_admin, nginx_host):
        client.post(
            "/api/nginx/files/upload",
            params={"path": "assets/logo.svg"},
            files={"file": ("whatever.svg", io.BytesIO(b"<svg/>"), "image/svg+xml")},
            headers=auth(sudo_admin),
        )

        assert (nginx_host["webroot"] / "assets/logo.svg").read_bytes() == b"<svg/>"

    def test_binary_content_survives_the_upload(self, client, sudo_admin, nginx_host):
        payload = bytes(range(256))

        client.post(
            "/api/nginx/files/upload",
            files={"file": ("inter.woff2", io.BytesIO(payload), "font/woff2")},
            headers=auth(sudo_admin),
        )

        assert (nginx_host["webroot"] / "inter.woff2").read_bytes() == payload

    def test_a_traversing_filename_cannot_escape_the_root(self, client, sudo_admin, nginx_host, tmp_path):
        response = client.post(
            "/api/nginx/files/upload",
            files={"file": ("../../escaped.html", io.BytesIO(b"nope"), "text/html")},
            headers=auth(sudo_admin),
        )

        assert response.status_code == 400
        assert not (tmp_path / "escaped.html").exists()

    def test_an_executable_extension_is_refused(self, client, sudo_admin, nginx_host):
        response = client.post(
            "/api/nginx/files/upload",
            files={"file": ("shell.php", io.BytesIO(b"<?php ?>"), "text/plain")},
            headers=auth(sudo_admin),
        )

        assert response.status_code == 400
        assert not (nginx_host["webroot"] / "shell.php").exists()

    def test_a_file_over_the_cap_is_refused(self, client, sudo_admin, nginx_host, monkeypatch):
        from app.utils import nginx as nginx_utils

        monkeypatch.setattr(nginx_utils, "NGINX_MAX_UPLOAD_BYTES", 10)

        response = client.post(
            "/api/nginx/files/upload",
            files={"file": ("index.html", io.BytesIO(b"x" * 64), "text/html")},
            headers=auth(sudo_admin),
        )

        assert response.status_code == 400

    def test_a_page_can_be_written_as_text(self, client, sudo_admin, nginx_host):
        response = client.put(
            "/api/nginx/files",
            json={"path": "index.html", "content": "<h1>edited</h1>"},
            headers=auth(sudo_admin),
        )

        assert response.status_code == 200
        assert (nginx_host["webroot"] / "index.html").read_text() == "<h1>edited</h1>"

    def test_a_page_is_read_back(self, client, sudo_admin, nginx_host):
        (nginx_host["webroot"] / "index.html").write_text("<h1>hi</h1>")

        body = client.get(
            "/api/nginx/files/content", params={"path": "index.html"}, headers=auth(sudo_admin)
        ).json()

        assert body["content"] == "<h1>hi</h1>"

    def test_reading_outside_the_root_is_refused(self, client, sudo_admin, nginx_host):
        response = client.get(
            "/api/nginx/files/content",
            params={"path": "../../etc/passwd"},
            headers=auth(sudo_admin),
        )

        assert response.status_code == 400

    def test_a_page_is_deleted(self, client, sudo_admin, nginx_host):
        (nginx_host["webroot"] / "index.html").write_text("hi")

        assert client.delete(
            "/api/nginx/files", params={"path": "index.html"}, headers=auth(sudo_admin)
        ).status_code == 200
        assert not (nginx_host["webroot"] / "index.html").exists()

    def test_deleting_through_a_symlink_cannot_reach_outside(
        self, client, sudo_admin, nginx_host, tmp_path
    ):
        secret = tmp_path / "secret.html"
        secret.write_text("secret")
        os.symlink(tmp_path, nginx_host["webroot"] / "link")

        response = client.delete(
            "/api/nginx/files", params={"path": "link/secret.html"}, headers=auth(sudo_admin)
        )

        assert response.status_code == 400
        assert secret.exists()


class TestLogs:
    def test_the_tail_is_returned(self, client, sudo_admin, nginx_host):
        (nginx_host["logs"] / "error.log").write_text("one\ntwo\nthree\n")

        body = client.get(
            "/api/nginx/logs/error", params={"lines": 2}, headers=auth(sudo_admin)
        ).json()

        assert body["content"].splitlines() == ["two", "three"]
        assert body["name"] == "error"

    def test_the_access_log_is_available_too(self, client, sudo_admin, nginx_host):
        (nginx_host["logs"] / "access.log").write_text("hit\n")

        assert client.get("/api/nginx/logs/access", headers=auth(sudo_admin)).status_code == 200

    def test_only_the_two_known_logs_are_routed(self, client, sudo_admin, nginx_host):
        assert client.get("/api/nginx/logs/passwd", headers=auth(sudo_admin)).status_code == 422

    def test_an_absurd_line_count_is_refused(self, client, sudo_admin, nginx_host):
        response = client.get(
            "/api/nginx/logs/error", params={"lines": 100000}, headers=auth(sudo_admin)
        )

        assert response.status_code == 422

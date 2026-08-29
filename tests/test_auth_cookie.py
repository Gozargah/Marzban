import pytest
from starlette.datastructures import Headers, URL

from app.utils import auth_cookie, client_ip as client_ip_module
from app.utils.auth_cookie import (ACCESS_TOKEN_COOKIE_NAME, clear_access_cookie,
                                   set_access_cookie, token_from_cookie,
                                   token_from_websocket)


class FakeClient:
    def __init__(self, host):
        self.host = host


class FakeRequest:
    def __init__(self, scheme="http", peer="203.0.113.9", cookies=None, **headers):
        self.url = URL(f"{scheme}://panel.example/api/admin/token")
        self.client = FakeClient(peer) if peer else None
        self.headers = Headers(headers)
        self.cookies = cookies or {}


class FakeWebSocket(FakeRequest):
    def __init__(self, query=None, **kwargs):
        super().__init__(**kwargs)
        self.query_params = query or {}


class Recorder:
    """Stands in for a Response, capturing the cookie calls."""

    def __init__(self):
        self.set = None
        self.deleted = None

    def set_cookie(self, **kwargs):
        self.set = kwargs

    def delete_cookie(self, **kwargs):
        self.deleted = kwargs


@pytest.fixture
def trust():
    original = client_ip_module._trusted_networks
    yield client_ip_module.configure
    client_ip_module._trusted_networks = original


class TestCookieAttributes:
    def test_cookie_is_httponly_and_strict(self):
        response = Recorder()
        set_access_cookie(response, FakeRequest(), "a.b.c")

        assert response.set["key"] == ACCESS_TOKEN_COOKIE_NAME
        assert response.set["value"] == "a.b.c"
        assert response.set["httponly"] is True
        assert response.set["samesite"] == "strict"
        assert response.set["path"] == "/"

    def test_plain_http_does_not_set_secure(self):
        response = Recorder()
        set_access_cookie(response, FakeRequest(scheme="http"), "a.b.c")

        assert response.set["secure"] is False

    def test_https_sets_secure(self):
        response = Recorder()
        set_access_cookie(response, FakeRequest(scheme="https"), "a.b.c")

        assert response.set["secure"] is True

    def test_expiry_follows_the_jwt_lifetime(self, monkeypatch):
        monkeypatch.setattr(auth_cookie, "JWT_ACCESS_TOKEN_EXPIRE_MINUTES", 60)
        response = Recorder()
        set_access_cookie(response, FakeRequest(), "a.b.c")

        assert response.set["max_age"] == 3600

    def test_never_expiring_tokens_get_a_session_cookie(self, monkeypatch):
        monkeypatch.setattr(auth_cookie, "JWT_ACCESS_TOKEN_EXPIRE_MINUTES", 0)
        response = Recorder()
        set_access_cookie(response, FakeRequest(), "a.b.c")

        assert response.set["max_age"] is None

    def test_clearing_matches_the_cookie_it_set(self):
        response = Recorder()
        set_access_cookie(response, FakeRequest(), "a.b.c")
        clear_access_cookie(response, FakeRequest())

        assert response.deleted["key"] == response.set["key"]
        assert response.deleted["path"] == response.set["path"]
        assert response.deleted["samesite"] == response.set["samesite"]


class TestSecureBehindAProxy:
    def test_forwarded_proto_from_a_trusted_proxy_is_honoured(self, trust):
        trust(["10.0.0.1"])
        response = Recorder()
        request = FakeRequest(scheme="http", peer="10.0.0.1", **{"X-Forwarded-Proto": "https"})
        set_access_cookie(response, request, "a.b.c")

        assert response.set["secure"] is True

    def test_forwarded_proto_from_an_untrusted_peer_is_ignored(self, trust):
        trust(["10.0.0.1"])
        response = Recorder()
        request = FakeRequest(scheme="http", peer="203.0.113.9", **{"X-Forwarded-Proto": "https"})
        set_access_cookie(response, request, "a.b.c")

        assert response.set["secure"] is False


class TestReadingTheToken:
    def test_cookie_is_read(self):
        request = FakeRequest(cookies={ACCESS_TOKEN_COOKIE_NAME: "a.b.c"})

        assert token_from_cookie(request) == "a.b.c"

    def test_missing_cookie_is_none(self):
        assert token_from_cookie(FakeRequest()) is None

    def test_websocket_prefers_the_cookie(self):
        websocket = FakeWebSocket(query={"token": "from-query"},
                                  cookies={ACCESS_TOKEN_COOKIE_NAME: "from-cookie"})

        assert token_from_websocket(websocket) == "from-cookie"

    def test_websocket_falls_back_to_the_query_param(self):
        assert token_from_websocket(FakeWebSocket(query={"token": "from-query"})) == "from-query"

    def test_websocket_falls_back_to_the_header(self):
        websocket = FakeWebSocket(**{"Authorization": "Bearer from-header"})

        assert token_from_websocket(websocket) == "from-header"


class TestTokenResolver:
    """get_token is what every authenticated endpoint depends on."""

    def test_authorization_header_wins(self):
        from app.models.admin import get_token

        request = FakeRequest(cookies={ACCESS_TOKEN_COOKIE_NAME: "from-cookie"})

        assert get_token(request, "from-header") == "from-header"

    def test_cookie_is_used_without_a_header(self):
        from app.models.admin import get_token

        request = FakeRequest(cookies={ACCESS_TOKEN_COOKIE_NAME: "from-cookie"})

        assert get_token(request, None) == "from-cookie"

    def test_no_credentials_yields_an_empty_token(self):
        from app.models.admin import get_token

        assert get_token(FakeRequest(), None) == ""

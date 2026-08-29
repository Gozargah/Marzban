"""The startup handler, and the assumptions it makes about `app.routes`.

Two pieces of wiring read `app.routes` expecting the individual routes to be
sitting there: `on_startup` refuses a subscription path that would shadow one,
and `use_route_names_as_operation_ids` names every operation after its handler.
A framework upgrade can quietly take that away — FastAPI 0.137 folds included
routers into a single object, which leaves the first raising AttributeError and
the second silently naming nothing, changing every operation id in the schema.

The rest of the suite cannot catch either. Its client fixture deliberately
skips the lifespan, so `on_startup` never runs, and nothing else asserts that
operation ids were assigned. Hence these, which call the handler directly with
the scheduler and the rlimit work stubbed out.
"""

import logging
import socket

import pytest
from fastapi.routing import APIRoute

import app as app_module
from app import app as fastapi_app
from app.utils import limits
from app.utils.jwt import token_expiry_warning


@pytest.fixture
def startup(monkeypatch):
    """`on_startup` with its side effects removed.

    Only the route bookkeeping is under test here; starting the scheduler and
    moving this process's rlimits are what the fixture takes away.
    """
    started = []
    monkeypatch.setattr(app_module.scheduler, "start", lambda: started.append(True))
    monkeypatch.setattr(limits, "raise_own_limits", lambda: limits.RaiseReport())
    monkeypatch.setattr(limits, "read_limits", lambda: [])
    return started


def api_routes():
    return [route for route in fastapi_app.routes if isinstance(route, APIRoute)]


class TestRoutesAreReachable:
    """`app.routes` has to hold the routes themselves, not a wrapper around them."""

    def test_the_api_routes_are_listed_individually(self):
        assert len(api_routes()) > 50

    def test_every_route_exposes_a_path(self):
        assert all(hasattr(route, "path") for route in fastapi_app.routes)

    def test_every_route_is_named_after_its_handler(self):
        routes = api_routes()
        unnamed = [route.path for route in routes if not route.operation_id]

        assert routes and unnamed == []

    def test_operation_ids_match_the_endpoint_names(self):
        routes = api_routes()
        mismatched = [route.path for route in routes if route.operation_id != route.name]

        assert routes and mismatched == []


class TestSubscriptionPathGuard:
    """The panel refuses to start on a subscription path that shadows the API."""

    def test_the_configured_path_starts_the_scheduler(self, startup):
        app_module.on_startup()

        assert startup == [True]

    def test_a_path_that_shadows_an_endpoint_is_refused(self, startup, monkeypatch):
        monkeypatch.setattr(app_module, "XRAY_SUBSCRIPTION_PATH", "api/system")

        with pytest.raises(ValueError):
            app_module.on_startup()

        assert startup == []

    def test_the_reserved_api_prefix_is_refused(self, startup, monkeypatch):
        monkeypatch.setattr(app_module, "XRAY_SUBSCRIPTION_PATH", "api")

        with pytest.raises(ValueError):
            app_module.on_startup()

        assert startup == []


class TestTokenExpiryWarning:
    """An expiry of zero is legitimate, and quiet enough to reach by accident."""

    def test_a_real_expiry_says_nothing(self):
        assert token_expiry_warning(1440) is None

    @pytest.mark.parametrize("minutes", [0, -1])
    def test_a_missing_expiry_is_called_out(self, minutes):
        warning = token_expiry_warning(minutes)

        assert warning is not None
        assert "JWT_ACCESS_TOKEN_EXPIRE_MINUTES" in warning

    def test_startup_says_it_where_an_operator_will_see_it(self, startup, monkeypatch, caplog):
        monkeypatch.setattr(app_module, "JWT_ACCESS_TOKEN_EXPIRE_MINUTES", 0)

        with caplog.at_level(logging.WARNING, logger="uvicorn.error"):
            app_module.on_startup()

        assert [r for r in caplog.records if "JWT_ACCESS_TOKEN_EXPIRE_MINUTES" in r.getMessage()]

    def test_startup_is_quiet_with_an_expiry_configured(self, startup, monkeypatch, caplog):
        monkeypatch.setattr(app_module, "JWT_ACCESS_TOKEN_EXPIRE_MINUTES", 1440)

        with caplog.at_level(logging.WARNING, logger="uvicorn.error"):
            app_module.on_startup()

        assert [r for r in caplog.records if "JWT_ACCESS_TOKEN_EXPIRE_MINUTES" in r.getMessage()] == []


class TestBindAddress:
    """Working out what to bind when no SSL certificate is configured.

    `check_and_modify_ip` resolves UVICORN_HOST to decide whether the panel may
    bind it directly. The lookup can fail, and it does not fail with the error
    the handler used to catch: socket.gethostbyname raises socket.gaierror,
    which is an OSError, so a hostname that does not resolve crashed the panel
    on startup instead of falling back to localhost.
    """

    def test_a_name_that_does_not_resolve_falls_back(self, monkeypatch):
        import main

        def unresolvable(name):
            raise socket.gaierror(-2, "Name or service not known")

        monkeypatch.setattr(main.socket, "gethostbyname", unresolvable)

        assert main.check_and_modify_ip("panel.invalid") == "localhost"

    def test_anything_that_is_not_an_address_falls_back(self, monkeypatch):
        import main

        monkeypatch.setattr(main.socket, "gethostbyname", lambda name: "not an address")

        assert main.check_and_modify_ip("panel.example.com") == "localhost"

    def test_the_wildcard_address_becomes_localhost(self):
        import main

        assert main.check_and_modify_ip("0.0.0.0") == "localhost"

    def test_a_private_address_is_kept(self):
        import main

        assert main.check_and_modify_ip("192.168.1.10") == "192.168.1.10"

    def test_a_public_address_is_not_bound_directly(self):
        import main

        assert main.check_and_modify_ip("8.8.8.8") == "localhost"

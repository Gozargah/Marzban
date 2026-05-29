"""Smoke tests: prove the app boots, an unauthenticated endpoint responds,
and the DB fixture is usable.

These exist to give CI something to run while real test coverage is built
up in Task 2 and Task 3. They should remain fast and self-contained.
"""

from app.db.models import Admin


def test_app_imports():
    """The FastAPI app imports and has routes registered."""
    import app as app_pkg

    assert hasattr(app_pkg, "app"), "app module must expose `app` (the FastAPI instance)"
    assert app_pkg.app.router is not None
    # At least the api_router endpoints + the home route should be present.
    assert len(app_pkg.app.routes) > 5


def test_public_endpoint_responds(client):
    """An unauthenticated subscription request with an invalid token returns
    a client error (404), never a server error.
    """
    response = client.get("/sub/invalid-token-for-smoke-test")
    assert response.status_code < 500, (
        f"public subscription endpoint returned server error: "
        f"{response.status_code} {response.text[:200]}"
    )


def test_db_session_fixture_works(db_session):
    """The db_session fixture lets us write and read a model row."""
    admin = Admin(username="smoke_test_admin", hashed_password="x", is_sudo=False)
    db_session.add(admin)
    db_session.flush()

    fetched = db_session.query(Admin).filter_by(username="smoke_test_admin").one()
    assert fetched.id is not None
    assert fetched.username == "smoke_test_admin"

import logging
import time
from base64 import b64encode
from calendar import timegm
from datetime import datetime
from hashlib import sha256

import jwt as pyjwt
import pytest

from app.utils import jwt as subs

SECRET = "test-secret-key"


@pytest.fixture(autouse=True)
def secret(monkeypatch):
    monkeypatch.setattr(subs, "get_secret_key", lambda: SECRET)
    monkeypatch.setattr(subs, "ACCEPT_LEGACY_SUBSCRIPTION_TOKENS", True)
    # The warning below fires once per process; each test starts from unsaid.
    monkeypatch.setattr(subs, "_warned_about_legacy_token", False)


def legacy_token(username: str, created_at: int) -> str:
    """Build a token exactly the way pre-HMAC versions did."""
    data = f"{username},{created_at}"
    payload = b64encode(data.encode(), altchars=b"-_").decode().rstrip("=")
    signature = b64encode(
        sha256((payload + SECRET).encode()).digest(), altchars=b"-_"
    ).decode()[:10]
    return payload + signature


class TestCurrentFormat:
    def test_round_trip(self):
        token = subs.create_subscription_token("user_1")
        payload = subs.get_subscription_payload(token)

        assert payload["username"] == "user_1"
        assert abs(timegm(payload["created_at"].timetuple()) - time.time()) < 5

    def test_signature_is_a_full_sha256_hmac(self):
        signature = subs.create_subscription_token("user_1").rpartition(".")[2]

        assert len(signature) == 43  # 256 bits, base64 without padding

    def test_tampered_signature_is_rejected(self):
        token = subs.create_subscription_token("user_1")
        payload, _, signature = token.rpartition(".")
        flipped = ("A" if signature[0] != "A" else "B") + signature[1:]

        assert subs.get_subscription_payload(f"{payload}.{flipped}") is None

    def test_tampered_payload_is_rejected(self):
        signature = subs.create_subscription_token("user_1").rpartition(".")[2]
        forged = subs._urlsafe_b64encode(b"admin,1700000000")

        assert subs.get_subscription_payload(f"{forged}.{signature}") is None

    def test_token_from_another_secret_is_rejected(self, monkeypatch):
        token = subs.create_subscription_token("user_1")
        monkeypatch.setattr(subs, "get_secret_key", lambda: "another-secret")

        assert subs.get_subscription_payload(token) is None


class TestLegacyFormat:
    def test_tokens_issued_before_the_hmac_change_still_verify(self):
        payload = subs.get_subscription_payload(legacy_token("olduser", 1700000000))

        assert payload["username"] == "olduser"
        assert timegm(payload["created_at"].timetuple()) == 1700000000

    def test_tampered_legacy_signature_is_rejected(self):
        token = legacy_token("olduser", 1700000000)

        assert subs.get_subscription_payload(token[:-10] + "0" * 10) is None

    def test_can_be_turned_off_without_affecting_current_tokens(self, monkeypatch):
        monkeypatch.setattr(subs, "ACCEPT_LEGACY_SUBSCRIPTION_TOKENS", False)

        assert subs.get_subscription_payload(legacy_token("olduser", 1700000000)) is None
        assert subs.get_subscription_payload(subs.create_subscription_token("u")) is not None


class TestLegacyTokensAreReported:
    """Whether anyone still holds an old link is what decides when the setting
    can be turned off, and nothing else in the panel would say so."""

    def legacy_warnings(self, caplog):
        return [r for r in caplog.records if "signature change" in r.getMessage()]

    def test_using_an_old_link_is_reported(self, caplog):
        with caplog.at_level(logging.WARNING, logger="uvicorn.error"):
            subs.get_subscription_payload(legacy_token("olduser", 1700000000))

        assert len(self.legacy_warnings(caplog)) == 1
        assert "olduser" in self.legacy_warnings(caplog)[0].getMessage()

    def test_it_is_said_once_however_many_links_are_served(self, caplog):
        with caplog.at_level(logging.WARNING, logger="uvicorn.error"):
            for username in ("olduser", "anotherold", "olduser"):
                subs.get_subscription_payload(legacy_token(username, 1700000000))

        assert len(self.legacy_warnings(caplog)) == 1

    def test_a_current_link_says_nothing(self, caplog):
        with caplog.at_level(logging.WARNING, logger="uvicorn.error"):
            subs.get_subscription_payload(subs.create_subscription_token("newuser"))

        assert self.legacy_warnings(caplog) == []

    def test_a_forged_old_link_says_nothing(self, caplog):
        """Only a link that actually worked means somebody has to migrate."""
        token = legacy_token("olduser", 1700000000)

        with caplog.at_level(logging.WARNING, logger="uvicorn.error"):
            subs.get_subscription_payload(token[:-10] + "0" * 10)

        assert self.legacy_warnings(caplog) == []


class TestJWTFormat:
    def test_subscription_jwt_is_accepted(self):
        token = pyjwt.encode(
            {"sub": "jwtuser", "access": "subscription", "iat": datetime.utcnow()},
            SECRET, algorithm="HS256",
        )

        assert subs.get_subscription_payload(token)["username"] == "jwtuser"

    def test_jwt_with_another_access_scope_is_rejected(self):
        token = pyjwt.encode(
            {"sub": "someone", "access": "admin", "iat": datetime.utcnow()},
            SECRET, algorithm="HS256",
        )

        assert subs.get_subscription_payload(token) is None


@pytest.mark.parametrize(
    "junk", ["", "short", "." * 20, "a" * 40, "...", "!" * 21, "a.b"]
)
def test_malformed_tokens_are_rejected_without_raising(junk):
    assert subs.get_subscription_payload(junk) is None

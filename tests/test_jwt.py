"""Tests for ``app.utils.jwt.get_subscription_payload``.

Pins the behavior of the bare-`except:` tightening at jwt.py:79
(docs/CODEBASE_MAP.md §6.5): malformed tokens that previously fell
through the bare except must still return None.
"""

from app.utils import jwt as jwt_utils


def test_get_subscription_payload_rejects_short_token():
    assert jwt_utils.get_subscription_payload("short") is None


def test_get_subscription_payload_rejects_non_base64_body(db_session):
    # 16+ chars but the body before the 10-char signature contains chars
    # that are not valid url-safe base64 (a `!`) → b64decode raises
    # binascii.Error, which the tightened handler must still swallow.
    # `db_session` is included so the JWT secret table is materialized in
    # case `get_subscription_payload` reaches `get_secret_key()`.
    token = "abc!def!ghi!jkl!" + "x" * 10
    assert jwt_utils.get_subscription_payload(token) is None

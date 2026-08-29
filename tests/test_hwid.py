"""Reading a device out of a subscription request, and resolving its limit.

The unit half of the device limit. What the header means, what a limit of
null or zero means, and where the boundaries are — the enforcement built on
top of this is in test_hwid_limit.py.
"""

import pytest

from app.utils import hwid
from app.utils.hwid import DeviceIdentity, effective_limit, identity_from_headers, is_enforced


class Headers(dict):
    """Case-insensitive, the way Starlette's are."""

    def get(self, key, default=None):
        for name, value in self.items():
            if name.lower() == key.lower():
                return value
        return default


def headers(**values) -> Headers:
    return Headers({key.replace("_", "-"): value for key, value in values.items()})


class User:
    """Just the field the limit is resolved from."""

    def __init__(self, hwid_device_limit=None):
        self.hwid_device_limit = hwid_device_limit


class TestIdentity:
    def test_a_bare_identifier_is_enough(self):
        assert identity_from_headers(headers(x_hwid="abc-123")) == DeviceIdentity(hwid="abc-123")

    def test_the_descriptive_headers_come_along(self):
        identity = identity_from_headers(
            headers(x_hwid="abc-123", x_device_os="iOS", x_ver_os="18.2", x_device_model="iPhone15,2")
        )

        assert identity.os == "iOS"
        assert identity.os_version == "18.2"
        assert identity.model == "iPhone15,2"

    def test_the_header_name_is_matched_case_insensitively(self):
        assert identity_from_headers(Headers({"X-HWID": "abc-123"})).hwid == "abc-123"

    def test_surrounding_whitespace_is_trimmed(self):
        assert identity_from_headers(headers(x_hwid="  abc-123  ")).hwid == "abc-123"

    def test_no_header_means_no_device(self):
        assert identity_from_headers(headers()) is None

    @pytest.mark.parametrize("value", ["", "   ", "ab", "abc"])
    def test_an_empty_or_too_short_identifier_is_not_one(self, value):
        assert identity_from_headers(headers(x_hwid=value)) is None

    def test_an_over_long_identifier_is_refused(self):
        assert identity_from_headers(headers(x_hwid="a" * (hwid.MAX_HWID_LENGTH + 1))) is None

    def test_an_identifier_at_the_limit_is_accepted(self):
        value = "a" * hwid.MAX_HWID_LENGTH

        assert identity_from_headers(headers(x_hwid=value)).hwid == value

    @pytest.mark.parametrize("value", ["abc\n123", "abc\t123", "abc 123", "abc\x00123"])
    def test_an_identifier_with_control_characters_is_refused(self, value):
        """Folding two different identifiers into one would undercount devices,
        so anything unparseable is refused rather than cleaned up."""
        assert identity_from_headers(headers(x_hwid=value)) is None

    def test_the_descriptive_headers_are_trimmed_to_a_displayable_length(self):
        identity = identity_from_headers(headers(x_hwid="abc-123", x_device_os="A" * 500))

        assert len(identity.os) == hwid.MAX_DETAIL_LENGTH

    def test_a_descriptive_header_of_control_characters_becomes_nothing(self):
        identity = identity_from_headers(headers(x_hwid="abc-123", x_device_os="\x00\x01"))

        assert identity.os is None

    def test_a_bad_descriptive_header_does_not_lose_the_device(self):
        """The identity is the hwid; the rest is decoration."""
        assert identity_from_headers(headers(x_hwid="abc-123", x_device_os="\x00")) is not None


class TestEffectiveLimit:
    @pytest.fixture(autouse=True)
    def no_global_default(self, monkeypatch):
        monkeypatch.setattr(hwid, "USERS_DEFAULT_HWID_DEVICE_LIMIT", 0)

    def test_a_users_own_limit_is_used(self):
        assert effective_limit(User(hwid_device_limit=3)) == 3

    def test_null_falls_back_to_the_panel_default(self, monkeypatch):
        monkeypatch.setattr(hwid, "USERS_DEFAULT_HWID_DEVICE_LIMIT", 5)

        assert effective_limit(User(hwid_device_limit=None)) == 5

    def test_a_users_own_limit_overrides_the_default(self, monkeypatch):
        monkeypatch.setattr(hwid, "USERS_DEFAULT_HWID_DEVICE_LIMIT", 5)

        assert effective_limit(User(hwid_device_limit=2)) == 2

    @pytest.mark.parametrize("limit", [0, -1])
    def test_zero_or_less_exempts_a_user_from_the_default(self, monkeypatch, limit):
        """The way to let one person off a limit everybody else has."""
        monkeypatch.setattr(hwid, "USERS_DEFAULT_HWID_DEVICE_LIMIT", 5)

        assert effective_limit(User(hwid_device_limit=limit)) == 0

    def test_nothing_is_enforced_by_default(self):
        assert is_enforced(User()) is False

    def test_a_limit_turns_enforcement_on(self):
        assert is_enforced(User(hwid_device_limit=1)) is True

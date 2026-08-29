"""Small shared helpers from app/utils/helpers.py.

`parse_version` decides which subscription format a client gets, and
`UUIDEncoder` is what serialises every JSON-shaped subscription, so a mistake
in either shows up as a wrong config or a 500 rather than a visible error.
"""

import json
from uuid import UUID, uuid4

import pytest

from app.utils.helpers import (UUIDEncoder, calculate_expiration_days,
                               calculate_usage_percent, parse_version)


class TestParseVersion:
    def test_parts_are_compared_numerically_not_as_text(self):
        assert parse_version("1.8.29") > parse_version("1.8.9")

    def test_a_shorter_version_sorts_first(self):
        assert parse_version("6.4") < parse_version("6.4.1")

    @pytest.mark.parametrize("version", ["6.40", "1.8.29"])
    def test_the_versions_the_router_matches_on_parse(self, version):
        assert parse_version(version)

    def test_a_non_numeric_part_is_refused(self):
        with pytest.raises(ValueError):
            parse_version("1.8.29-beta")


class TestUsageHelpers:
    @pytest.mark.parametrize(
        "used, limit, expected",
        [(0, 100, 0), (50, 100, 50), (100, 100, 100), (150, 100, 150)],
    )
    def test_the_usage_percentage(self, used, limit, expected):
        assert calculate_usage_percent(used, limit) == expected

    def test_an_unlimited_user_cannot_be_measured(self):
        with pytest.raises(ZeroDivisionError):
            calculate_usage_percent(10, 0)

    def test_days_left_is_negative_once_expired(self):
        assert calculate_expiration_days(0) < 0


class TestUUIDEncoder:
    def test_a_uuid_is_written_as_its_string_form(self):
        value = uuid4()

        assert json.dumps({"id": value}, cls=UUIDEncoder) == json.dumps({"id": str(value)})

    def test_a_nested_uuid_is_handled_too(self):
        value = UUID("35e4e39c-7d5c-4f4b-8b71-558e4f37ff53")
        encoded = json.dumps({"clients": [{"id": value}]}, cls=UUIDEncoder)

        assert "35e4e39c-7d5c-4f4b-8b71-558e4f37ff53" in encoded

    def test_ordinary_values_are_untouched(self):
        payload = {"port": 443, "tls": True, "sni": "example.com", "alpn": None}

        assert json.loads(json.dumps(payload, cls=UUIDEncoder)) == payload

    def test_an_unsupported_object_reports_what_it_is(self):
        """The fallback has to reach JSONEncoder.default with just the object.

        Passing `self` along as well turned every unserialisable value into a
        confusing "default() takes 2 positional arguments but 3 were given"
        instead of naming the type that could not be encoded.
        """

        class Unserialisable:
            pass

        with pytest.raises(TypeError, match="Unserialisable"):
            json.dumps({"x": Unserialisable()}, cls=UUIDEncoder)

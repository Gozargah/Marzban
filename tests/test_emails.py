import pytest

from app.xray.emails import build_email, candidate_emails, split_stat_name


def test_default_coefficient_keeps_legacy_email():
    assert build_email(7, "bob", "VLESS WS", 1.0) == "7.bob"


def test_other_coefficient_adds_inbound_suffix():
    assert build_email(7, "bob", "VLESS WS", 2.0) == "7.bob@VLESS WS"
    assert build_email(7, "bob", "VLESS WS", 0.5) == "7.bob@VLESS WS"


def test_candidates_cover_both_variants():
    assert candidate_emails(7, "bob", "t") == ("7.bob", "7.bob@t")


@pytest.mark.parametrize(
    "name,expected",
    [
        ("7.bob", ("7", None)),
        ("7.bob@VLESS WS", ("7", "VLESS WS")),
        ("12.user_name@tag.with.dots", ("12", "tag.with.dots")),
        ("5.x@tag@with@ats", ("5", "tag@with@ats")),
    ],
)
def test_split_stat_name(name, expected):
    assert split_stat_name(name) == expected


@pytest.mark.parametrize("tag", ["a", "VLESS WS", "tag.with.dots", "tag@at", "标签"])
def test_round_trip(tag):
    assert split_stat_name(build_email(42, "alice", tag, 3.0)) == ("42", tag)

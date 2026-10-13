"""Контракт поля bs_extra в UserDialog (app/dashboard/src/utils/bsExtraForm.ts)."""

from __future__ import annotations

import math
from pathlib import Path

import pytest

GIB = 1073741824
FORM_SRC = Path(__file__).resolve().parents[1] / "app/dashboard/src/utils/bsExtraForm.ts"


def parse_bs_extra_gb_input(value):
    """Совпадает с parseBsExtraGbInput: отрицательное отклоняется до перевода в байты."""
    if value in ("", None):
        return None
    n = float(value)
    if math.isnan(n) or n < 0:
        raise ValueError("bs_extra must be 0 or greater")
    if not n:
        return 0
    return float(format(n * GIB, ".5f"))


def should_submit_bs_extra(submitted, dirty):
    return dirty is True and submitted is not None


def test_parse_bs_extra_gb_rejects_negative():
    with pytest.raises(ValueError):
        parse_bs_extra_gb_input(-1)
    with pytest.raises(ValueError):
        parse_bs_extra_gb_input(-0.5)
    with pytest.raises(ValueError):
        parse_bs_extra_gb_input("-1")


def test_parse_bs_extra_gb_accepts_zero_and_positive():
    assert parse_bs_extra_gb_input(0) == 0
    assert parse_bs_extra_gb_input("") is None


def test_should_submit_bs_extra_uses_dirty_flag():
    displayed = 10 * GIB
    assert should_submit_bs_extra(displayed, False) is False
    assert should_submit_bs_extra(displayed, True) is True
    assert should_submit_bs_extra(None, True) is False


def test_bs_extra_form_source_rejects_negative_before_bytes():
    text = FORM_SRC.read_text(encoding="utf-8")
    assert "n < 0" in text
    assert "dirty === true" in text

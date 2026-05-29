"""Functional + structural proof that the DB/models layer is decoupled
from ``app.xray``.

Functional: ``User.inbounds`` and the user.py / user_template.py
validators behave correctly when a fake ``InboundLookup`` is injected.
This proves the new indirection is load-bearing — it's not a cosmetic
rename.

Structural: ``app/db/`` and ``app/models/`` contain no direct
``app.xray`` imports outside of the lazy lookup implementation in
``app/db/lookups.py``.

Reframed from the original Step-5 test #1 per the user's clarification:
we don't try to prove "app.xray module never loaded" (that's
unreachable in Task 2 because of the transitive
``app.models.user → app.subscription.share → app.xray`` chain, which is
a Task 3 / lifespan concern).
"""

import re
from pathlib import Path

import pytest

from app.db import crud
from app.db.lookups import reset_lookup, set_lookup
from app.db.models import Proxy, User
from app.models.proxy import ProxyTypes


@pytest.fixture(autouse=True)
def _restore_default_lookup():
    yield
    reset_lookup()


class _FakeInboundLookup:
    def __init__(self, tags_by_protocol=None, valid_tags=None):
        self._tags = tags_by_protocol or {}
        if valid_tags is None:
            valid_tags = {t for ts in self._tags.values() for t in ts}
        self._valid_tags = set(valid_tags)

    def tags_by_protocol(self):
        return self._tags

    def tag_exists(self, tag):
        return tag in self._valid_tags


# --- Functional proof: User.inbounds resolves through the injected lookup ---


def test_user_inbounds_uses_injected_lookup(db_session):
    # Seed inbound rows so the (already-fake) lookup's tags can be referenced.
    for tag in ("INBOUND_A", "INBOUND_B"):
        crud.get_or_create_inbound(db_session, tag)

    set_lookup(_FakeInboundLookup(tags_by_protocol={"vmess": ["INBOUND_A", "INBOUND_B"]}))

    user = User(username="lookup_test_user", status="active")
    user.proxies = [Proxy(type=ProxyTypes.VMess, settings={"id": "id-1"})]
    db_session.add(user)
    db_session.flush()

    assert user.inbounds == {"vmess": ["INBOUND_A", "INBOUND_B"]}


def test_user_inbounds_respects_excluded_inbounds(db_session):
    # Three known inbounds; the proxy excludes the middle one.
    inbound_a = crud.get_or_create_inbound(db_session, "INBOUND_A")
    inbound_b = crud.get_or_create_inbound(db_session, "INBOUND_B")
    inbound_c = crud.get_or_create_inbound(db_session, "INBOUND_C")

    set_lookup(_FakeInboundLookup(
        tags_by_protocol={"vmess": ["INBOUND_A", "INBOUND_B", "INBOUND_C"]}
    ))

    proxy = Proxy(type=ProxyTypes.VMess, settings={"id": "id-2"})
    proxy.excluded_inbounds = [inbound_b]

    user = User(username="excluded_test_user", status="active")
    user.proxies = [proxy]
    db_session.add(user)
    db_session.flush()

    # Important: the inbound_a / inbound_c references silence ruff F841
    # while documenting which fixture rows the assertion implicitly depends on.
    assert (inbound_a, inbound_c) is not None
    assert user.inbounds == {"vmess": ["INBOUND_A", "INBOUND_C"]}


# --- Functional proof: UserCreate validator goes through the lookup --------


def test_usercreate_validate_inbounds_uses_lookup_for_tag_existence():
    from app.models.user import UserCreate

    set_lookup(_FakeInboundLookup(
        tags_by_protocol={"vmess": ["INBOUND_A"]},
        valid_tags={"INBOUND_A"},
    ))

    # Valid tag → no error.
    UserCreate(
        username="valid",
        proxies={"vmess": {"id": "00000000-0000-0000-0000-000000000001"}},
        inbounds={"vmess": ["INBOUND_A"]},
    )

    # Unknown tag → ValueError surfaced via Pydantic ValidationError.
    with pytest.raises(Exception) as excinfo:
        UserCreate(
            username="invalid",
            proxies={"vmess": {"id": "00000000-0000-0000-0000-000000000002"}},
            inbounds={"vmess": ["NOT_A_REAL_TAG"]},
        )
    assert "NOT_A_REAL_TAG" in str(excinfo.value)


# --- Structural proof: no direct app.xray imports under app/db, app/models -


_REPO_ROOT = Path(__file__).resolve().parent.parent
_FORBIDDEN_PATTERNS = (
    re.compile(r"^\s*from\s+app\s+import\s+xray\b", re.MULTILINE),
    re.compile(r"^\s*from\s+app\.xray\s+import\b", re.MULTILINE),
    re.compile(r"^\s*import\s+app\.xray\b", re.MULTILINE),
)
# The lookup module is allowed to lazy-import app.xray inside its
# methods. Any other file under app/db or app/models must be free of
# direct app.xray imports.
_ALLOWLIST = {"app/db/lookups.py"}


@pytest.mark.parametrize("subtree", ["app/db", "app/models"])
def test_no_direct_xray_imports_under(subtree):
    offenders = []
    for path in (_REPO_ROOT / subtree).rglob("*.py"):
        rel = str(path.relative_to(_REPO_ROOT))
        if rel in _ALLOWLIST:
            continue
        source = path.read_text()
        for pattern in _FORBIDDEN_PATTERNS:
            for match in pattern.finditer(source):
                line_no = source.count("\n", 0, match.start()) + 1
                offenders.append(f"{rel}:{line_no}: {match.group(0).strip()}")

    assert not offenders, (
        "Direct app.xray imports re-introduced under "
        f"{subtree} (Task 2 decoupling regression):\n  "
        + "\n  ".join(offenders)
    )

"""Xray client emails.

Xray reports traffic per client email. Inbounds with a usage coefficient other
than 1 get a per-inbound email (``<id>.<username>@<inbound_tag>``) so their
traffic can be told apart from the user's other traffic and multiplied. The
``<id>.`` prefix is kept so the user id can always be parsed first.
"""

from typing import Optional, Tuple


def build_email(user_id: int, username: str, inbound_tag: str, coefficient: float = 1.0) -> str:
    base = f"{user_id}.{username}"
    return base if coefficient == 1 else f"{base}@{inbound_tag}"


def candidate_emails(user_id: int, username: str, inbound_tag: str) -> Tuple[str, str]:
    """Both email variants a user may have on an inbound (used when removing)."""
    return build_email(user_id, username, inbound_tag, 1.0), build_email(user_id, username, inbound_tag, 0)


def split_stat_name(name: str) -> Tuple[str, Optional[str]]:
    """Return (user id, inbound tag or None) from the email part of a stats key."""
    identity, _, tag = name.partition("@")
    return identity.split(".", 1)[0], (tag or None)

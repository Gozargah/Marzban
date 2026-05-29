"""Regression tests for ``app/db/crud`` node helpers.

Tracks the bug noted in docs/CODEBASE_MAP.md §6.10: prior to v0.9.0,
`create_node` ignored `NodeCreate.usage_coefficient` and the DB default
of 1.0 was always used regardless of the submitted value.
"""

from app.db import crud
from app.models.node import NodeCreate


def test_create_node_persists_usage_coefficient(db_session):
    payload = NodeCreate(
        name="test-node-coef",
        address="10.0.0.1",
        port=62050,
        api_port=62051,
        usage_coefficient=2.5,
    )

    node = crud.create_node(db_session, payload)

    assert node.id is not None
    assert node.usage_coefficient == 2.5


def test_create_node_defaults_usage_coefficient_to_one(db_session):
    payload = NodeCreate(
        name="test-node-default",
        address="10.0.0.2",
        port=62050,
        api_port=62051,
    )

    node = crud.create_node(db_session, payload)

    assert node.usage_coefficient == 1.0

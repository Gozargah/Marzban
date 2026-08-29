from datetime import datetime, timedelta

import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.db.base import Base
from app.db.crud import get_usage_series
from app.db.models import Node, NodeUsage


@pytest.fixture
def db():
    engine = create_engine("sqlite://", connect_args={"check_same_thread": False})
    Base.metadata.create_all(engine)
    session = sessionmaker(bind=engine)()
    yield session
    session.close()


@pytest.fixture
def nodes(db):
    created = [Node(name=f"node-{i}", address=f"10.0.0.{i}", port=62050, api_port=62051) for i in (1, 2)]
    db.add_all(created)
    db.commit()
    return created


def record(db, node, when, uplink, downlink):
    db.add(NodeUsage(created_at=when, node_id=node.id, uplink=uplink, downlink=downlink))
    db.commit()


BASE = datetime(2026, 5, 1, 12, 0, 0)


class TestHourlyBuckets:
    def test_empty_range_is_empty(self, db):
        assert get_usage_series(db, BASE - timedelta(days=1), BASE) == []

    def test_one_record_per_node_is_summed(self, db, nodes):
        record(db, nodes[0], BASE, 10, 20)
        record(db, nodes[1], BASE, 1, 2)

        assert get_usage_series(db, BASE - timedelta(hours=1), BASE) == [(BASE, 11, 22)]

    def test_hours_stay_separate(self, db, nodes):
        record(db, nodes[0], BASE, 10, 20)
        record(db, nodes[0], BASE + timedelta(hours=1), 5, 5)
        series = get_usage_series(db, BASE, BASE + timedelta(hours=2))

        assert series == [(BASE, 10, 20), (BASE + timedelta(hours=1), 5, 5)]

    def test_result_is_ordered_by_time(self, db, nodes):
        for offset in (3, 1, 2):
            record(db, nodes[0], BASE + timedelta(hours=offset), offset, offset)
        times = [point[0] for point in get_usage_series(db, BASE, BASE + timedelta(hours=4))]

        assert times == sorted(times)

    def test_records_outside_the_range_are_ignored(self, db, nodes):
        record(db, nodes[0], BASE - timedelta(hours=5), 99, 99)
        record(db, nodes[0], BASE, 1, 1)

        assert get_usage_series(db, BASE - timedelta(hours=1), BASE) == [(BASE, 1, 1)]


class TestDailyBuckets:
    def test_hours_fold_into_their_day(self, db, nodes):
        day = BASE.replace(hour=0)
        record(db, nodes[0], BASE, 10, 20)
        record(db, nodes[0], BASE + timedelta(hours=3), 5, 5)
        record(db, nodes[1], BASE + timedelta(hours=6), 1, 1)

        assert get_usage_series(db, BASE - timedelta(days=1), BASE + timedelta(days=1), by_day=True) == [(day, 16, 26)]

    def test_days_stay_separate(self, db, nodes):
        record(db, nodes[0], BASE, 10, 20)
        record(db, nodes[0], BASE + timedelta(days=1), 7, 7)
        series = get_usage_series(db, BASE - timedelta(days=1), BASE + timedelta(days=2), by_day=True)

        assert [point[0].day for point in series] == [BASE.day, BASE.day + 1]


class TestMissingValues:
    def test_null_counters_are_treated_as_zero(self, db, nodes):
        db.add(NodeUsage(created_at=BASE, node_id=nodes[0].id, uplink=None, downlink=None))
        db.commit()

        assert get_usage_series(db, BASE - timedelta(hours=1), BASE) == [(BASE, 0, 0)]

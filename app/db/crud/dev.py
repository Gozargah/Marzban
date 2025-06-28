from datetime import datetime, timezone
from random import randint

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db import User
from app.db.models import Node, NodeUserUsage, NodeUsage


def get_last_hour(dt: datetime) -> datetime:
    return dt.replace(minute=0, second=0, microsecond=0)


async def generate_node_user_usage(session: AsyncSession, fake, hours_back=24):
    records = []
    existing_combinations = set()
    user_ids = (await session.execute(select(User.id))).scalars().all()
    node_ids = (await session.execute(select(Node.id))).scalars().all()
    result = await session.execute(select(NodeUserUsage.created_at, NodeUserUsage.user_id, NodeUserUsage.node_id))
    existing_combinations.update(result.all())
    for _ in range(500):  # Try to generate up to 100 valid records
        attempts = 0
        while attempts < 100:  # Avoid infinite loop
            user_id = fake.random_element(elements=user_ids)
            node_id = fake.random_element(elements=node_ids)
            created_at = get_last_hour(
                fake.date_time_between(start_date=f"-{hours_back}h", end_date="now", tzinfo=timezone.utc)
            )

            key = (created_at, user_id, node_id)
            if key not in existing_combinations:
                break
            attempts += 1
        else:
            # Failed to find a unique combination after many tries
            print("⚠️ Could not generate more unique NodeUserUsage entries.")
            continue

        used_traffic = randint(1_000_000, 1_000_000_000)  # 1MB to 1GB
        record = NodeUserUsage(created_at=created_at, user_id=user_id, node_id=node_id, used_traffic=used_traffic)
        records.append(record)
        existing_combinations.add(key)

    session.add_all(records)
    await session.commit()


async def generate_node_usage(session: AsyncSession, fake, hours_back=24):
    records = []
    existing_combinations = set()
    node_ids = (await session.execute(select(Node.id))).scalars().all()
    result = await session.execute(select(NodeUsage.created_at, NodeUsage.node_id))
    existing_combinations.update(result.all())

    for _ in range(150):  # Try to generate up to 50 valid records
        attempts = 0
        while attempts < 20:  # Limit retries to prevent infinite loop
            node_id = fake.random_element(elements=node_ids)
            created_at = get_last_hour(
                fake.date_time_between(start_date=f"-{hours_back}h", end_date="now", tzinfo=timezone.utc)
            )

            key = (created_at, node_id)
            if key not in existing_combinations:
                break
            attempts += 1
        else:
            print("⚠️ Could not generate more unique NodeUsage entries.")
            continue

        uplink = randint(1_000_000, 1_000_000_000)
        downlink = randint(1_000_000, 1_000_000_000)

        record = NodeUsage(created_at=created_at, node_id=node_id, uplink=uplink, downlink=downlink)
        records.append(record)
        existing_combinations.add(key)

    session.add_all(records)
    await session.commit()

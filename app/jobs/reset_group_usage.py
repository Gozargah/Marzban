from datetime import datetime

from app import logger, scheduler
from app.db import GetDB
from app.db.models import HostGroup, UserGroupUsage

reset_strategy_to_days = {
    "day": 1,
    "week": 7,
    "month": 30,
    "year": 365,
}


def reset_group_usage():
    """Periodically zero per-user group counters per the group's reset_strategy.
    Inert when no group uses a reset strategy."""
    now = datetime.utcnow()
    try:
        with GetDB() as db:
            groups = db.query(HostGroup).filter(
                HostGroup.reset_strategy != "no_reset"
            ).all()
            if not groups:
                return
            for g in groups:
                days = reset_strategy_to_days.get(g.reset_strategy)
                if not days:
                    continue
                changed = 0
                rows = db.query(UserGroupUsage).filter(
                    UserGroupUsage.group_id == g.id
                ).all()
                for r in rows:
                    if r.reset_at is None:
                        r.reset_at = now  # initialise baseline
                        continue
                    if (now - r.reset_at).days >= days:
                        r.used_traffic = 0
                        r.reset_at = now
                        changed += 1
                if changed:
                    logger.info(
                        f"Group '{g.name}': reset traffic for {changed} users"
                    )
            db.commit()
    except Exception as err:
        # table may not exist yet (pre-migration) — stay quiet & inert
        logger.debug(f"reset_group_usage skipped: {err}")


scheduler.add_job(reset_group_usage, 'interval', coalesce=True, hours=1)

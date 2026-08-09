from datetime import datetime, timedelta

from app import logger, scheduler
from app.db import GetDB, crud
from config import AUDIT_LOG_RETENTION_DAYS


def purge_audit_logs():
    """Drops admin-history rows older than AUDIT_LOG_RETENTION_DAYS.

    Inert when retention is 0 (keep forever) or the table doesn't exist yet
    (i.e. the yuku0008 migration hasn't been applied).
    """
    if AUDIT_LOG_RETENTION_DAYS <= 0:
        return
    cutoff = datetime.utcnow() - timedelta(days=AUDIT_LOG_RETENTION_DAYS)
    try:
        with GetDB() as db:
            deleted = crud.purge_audit_logs(db, cutoff)
        if deleted:
            logger.info(f"Audit log: purged {deleted} rows older than {cutoff}")
    except Exception as err:
        logger.debug(f"purge_audit_logs skipped: {err}")


scheduler.add_job(purge_audit_logs, "interval", coalesce=True, hours=24)

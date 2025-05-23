import logging
from datetime import datetime

from app import scheduler
from app.db import GetDB
from app.db.token_blacklist import cleanup_expired_tokens
from config import JOB_CLEANUP_TOKEN_BLACKLIST_INTERVAL

logger = logging.getLogger(__name__)


def cleanup_token_blacklist_job():
    """
    Job to clean up expired tokens from the blacklist
    """
    logger.info("Running token blacklist cleanup job")
    
    with GetDB() as db:
        count = cleanup_expired_tokens(db)
        
    if count > 0:
        logger.info(f"Removed {count} expired tokens from blacklist")


# Schedule the job to run based on the configured interval
scheduler.add_job(
    cleanup_token_blacklist_job,
    "interval",
    hours=JOB_CLEANUP_TOKEN_BLACKLIST_INTERVAL,
    id="cleanup_token_blacklist",
    replace_existing=True,
) 
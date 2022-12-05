from app import logger, scheduler, xray
from app.jobs.add_db_users import add_users_from_db
from app.utils import check_port


def check():
    if not check_port(xray.config.api_port):
        xray.core.stop()
        xray.core.start(xray.config)
        add_users_from_db()
        logger.warning("XRay core restarted")


scheduler.add_job(check, 'interval', seconds=5)

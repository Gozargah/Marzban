import traceback

from app import app, logger, scheduler, xray
from app.utils.concurrency import threaded_function


def core_health_check():
    if not xray.core.started:
        xray.core.restart(xray.config.include_db_users())


@app.on_event("startup")
@threaded_function
def app_startup():
    logger.info('Starting Xray core')
    try:
        xray.core.start(xray.config.include_db_users())
    except Exception:
        traceback.print_exc()
    scheduler.add_job(core_health_check, 'interval', seconds=15)


@app.on_event("shutdown")
def app_shutdown():
    xray.core.stop()

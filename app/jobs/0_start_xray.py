import traceback
import asyncio

from app import app, logger, scheduler, xray


async def core_health_check():
    while True:
        if not xray.core.started:
            await xray.core.restart(xray.config.include_db_users())
        await asyncio.sleep(15)


@app.on_event("startup")
async def app_startup():
    logger.info('Starting Xray core')
    try:
        await xray.core.start(xray.config.include_db_users())
    except Exception:
        traceback.print_exc()
    asyncio.get_event_loop().create_task(core_health_check())


@app.on_event("shutdown")
async def app_shutdown():
    await xray.core.stop()

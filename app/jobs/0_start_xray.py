from app import app, xray
import traceback


@app.on_event("startup")
def app_startup():
    try:
        xray.core.start(xray.config.include_db_users())
    except Exception:
        traceback.print_exc()


@app.on_event("shutdown")
def app_shutdown():
    xray.core.stop()

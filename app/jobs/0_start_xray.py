from app import app, xray
from app.utils.xray import xray_config_include_db_clients


@app.on_event("startup")
def app_startup():
    xray.core.start(
        xray_config_include_db_clients(xray.config)
    )


@app.on_event("shutdown")
def app_shutdown():
    xray.core.stop()

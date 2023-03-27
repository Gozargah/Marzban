from app import app, xray


@app.on_event("startup")
def app_startup():
    xray.core.start(xray.config.include_db_users())


@app.on_event("shutdown")
def app_shutdown():
    xray.core.stop()

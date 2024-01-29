import logging
import sys

from apscheduler.schedulers.background import BackgroundScheduler
from fastapi import FastAPI, Request, status
from fastapi.encoders import jsonable_encoder
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.routing import APIRoute
from fastapi_responses import custom_openapi

from app.utils.store import DictStorage
from config import DOCS, XRAY_SUBSCRIPTION_PATH

__version__ = "0.4.1"


app = FastAPI(
    title="MarzbanAPI",
    description="Unified GUI Censorship Resistant Solution Powered by Xray",
    version=__version__,
    docs_url='/docs' if DOCS else None,
    redoc_url='/redoc' if DOCS else None
)
app.state.is_running = False

app.openapi = custom_openapi(app)
scheduler = BackgroundScheduler({'apscheduler.job_defaults.max_instances': 20}, timezone='UTC')
logger = logging.getLogger('uvicorn.error')
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@DictStorage
def settings(storage: dict):
    from app.db import GetDB, crud

    # load settings only when the app is running
    # to prevent problem in cli or alembic
    if not app.state.is_running:
        return {}

    storage.clear()
    with GetDB() as db:
        dbsettings = crud.get_settings(db)

        # load settings fields as a dict
        for key, value in dbsettings.__dict__.items():
            if key not in ('_sa_instance_state', 'id'):
                storage[key] = value

        # keys to be parsed
        storage['telegram_admins'] = list(
            map(int, filter(
                bool, (storage.get('telegram_admin_ids') or '').strip(',').split(',')
            ))
        )


from app import dashboard, jobs, telegram, views  # noqa


def use_route_names_as_operation_ids(app: FastAPI) -> None:
    for route in app.routes:
        if isinstance(route, APIRoute):
            route.operation_id = route.name


use_route_names_as_operation_ids(app)


@app.on_event("startup")
def on_startup():
    app.state.is_running = True
    paths = [f"{r.path}/" for r in app.routes]
    paths.append("/api/")
    if f"/{XRAY_SUBSCRIPTION_PATH}/" in paths:
        raise ValueError(f"you can't use /{XRAY_SUBSCRIPTION_PATH}/ as subscription path it reserved for {app.title}")
    scheduler.start()


@app.on_event("shutdown")
def on_shutdown():
    app.state.is_running = False
    scheduler.shutdown()


@app.exception_handler(RequestValidationError)
def validation_exception_handler(request: Request, exc: RequestValidationError):
    details = {}
    for error in exc.errors():
        details[error["loc"][-1]] = error.get("msg")
    return JSONResponse(
        status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
        content=jsonable_encoder({"detail": details}),
    )

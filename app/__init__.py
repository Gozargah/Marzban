import logging
from contextlib import asynccontextmanager

from apscheduler.schedulers.background import BackgroundScheduler
from fastapi import FastAPI, Request, status
from fastapi.encoders import jsonable_encoder
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.routing import APIRoute

from config import ALLOWED_ORIGINS, DOCS, WEBHOOK_ADDRESS, XRAY_SUBSCRIPTION_PATH

__version__ = "0.8.4"

scheduler = BackgroundScheduler(
    {"apscheduler.job_defaults.max_instances": 20}, timezone="UTC"
)
logger = logging.getLogger("uvicorn.error")


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Unified startup / shutdown for the panel.

    Replaces the four `@app.on_event("startup")` and three
    `@app.on_event("shutdown")` handlers that were spread across
    app/__init__.py, app/dashboard, app/jobs/xray_core,
    app/jobs/send_notifications, and app/telegram. The ordering below
    preserves the previous registration / reverse-registration order
    EXACTLY:

    Startup, in original registration order:
        1. dashboard.startup           — mount static / spawn dev server
        2. xray_core.start_core        — build config, start core, connect
                                         nodes, schedule core_health_check
        3. telegram.start_bot          — spawn polling thread (no-op if
                                         TELEGRAM_API_TOKEN unset)
        4. validate sub path + start scheduler

    Shutdown, in REVERSE registration order:
        3. scheduler.shutdown()
        2. flush_pending_notifications() — only if WEBHOOK_ADDRESS
        1. xray_core.stop_core_and_disconnect_nodes()

    These imports are deferred to lifespan-invocation time so module
    construction order in `from app import dashboard, jobs, routers,
    telegram` below stays unconstrained.
    """
    # Lazy imports — submodules are loaded by the top-level
    # `from app import dashboard, jobs, routers, telegram` block (further
    # down in this file). By the time lifespan runs, everything is
    # importable.
    from app.dashboard import startup as dashboard_startup
    from app.jobs.xray_core import (
        start_core,
        stop_core_and_disconnect_nodes,
    )
    from app.telegram import start_bot

    # --- Startup, original registration order ---
    dashboard_startup()
    start_core()
    start_bot()
    # Inlined former `on_startup()`:
    paths = [f"{r.path}/" for r in app.routes]
    paths.append("/api/")
    if f"/{XRAY_SUBSCRIPTION_PATH}/" in paths:
        raise ValueError(
            f"you can't use /{XRAY_SUBSCRIPTION_PATH}/ as subscription path it reserved for {app.title}"
        )
    scheduler.start()

    try:
        yield
    finally:
        # --- Shutdown, REVERSE registration order ---
        # 3. scheduler shutdown (inlined former `on_shutdown()`)
        scheduler.shutdown()
        # 2. webhook flush, conditional on WEBHOOK_ADDRESS
        if WEBHOOK_ADDRESS:
            from app.jobs.send_notifications import flush_pending_notifications
            flush_pending_notifications()
        # 1. stop xray core + disconnect nodes
        stop_core_and_disconnect_nodes()


app = FastAPI(
    title="MarzbanAPI",
    description="Unified GUI Censorship Resistant Solution Powered by Xray",
    version=__version__,
    docs_url="/docs" if DOCS else None,
    redoc_url="/redoc" if DOCS else None,
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
from app import dashboard, jobs, routers, telegram  # noqa
from app.routers import api_router  # noqa

app.include_router(api_router)


def use_route_names_as_operation_ids(app: FastAPI) -> None:
    for route in app.routes:
        if isinstance(route, APIRoute):
            route.operation_id = route.name


use_route_names_as_operation_ids(app)


@app.exception_handler(RequestValidationError)
def validation_exception_handler(request: Request, exc: RequestValidationError):
    details = {}
    for error in exc.errors():
        details[error["loc"][-1]] = error.get("msg")
    return JSONResponse(
        status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
        content=jsonable_encoder({"detail": details}),
    )

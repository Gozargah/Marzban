from fastapi import APIRouter
from . import (
    admin,
    core,
    node,
    subscription,
    system,
    user_template,
    user,
    home,
    host,
    group,
    dev
)

api_router = APIRouter()

routers = [
    home.router,
    admin.router,
    system.router,
    group.router,
    core.router,
    host.router,
    node.router,
    user.router,
    subscription.router,
    user_template.router,
    dev.router
]

for router in routers:
    api_router.include_router(router)

__all__ = ["api_router"]

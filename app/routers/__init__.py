from fastapi import APIRouter

from . import (
    admin,
    core,
    group,
    home,
    node,
    subscription,
    system,
    user,
    user_template,
    host,
)

api_router = APIRouter()

routers = [
    admin.router,
    group.router,
    home.router,
    system.router,
    core.router,
    host.router,
    node.router,
    user.router,
    subscription.router,
    user_template.router
]

for router in routers:
    api_router.include_router(router)

__all__ = ["api_router"]

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
)

api_router = APIRouter()

routers = [
    admin.router,
    core.router,
    node.router,
    subscription.router,
    system.router,
    user_template.router,
    user.router,
    group.router,
    home.router,
]

for router in routers:
    api_router.include_router(router)

__all__ = ["api_router"]

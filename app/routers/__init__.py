from fastapi import APIRouter
from . import (
    admin,
    audit,
    core,
    host_group,
    node,
    subscription,
    system,
    user_template,
    user,
    home,
    yuku,
)

api_router = APIRouter()

routers = [
    admin.router,
    audit.router,
    core.router,
    host_group.router,
    node.router,
    subscription.router,
    system.router,
    user_template.router,
    user.router,
    home.router,
    yuku.router,
]

for router in routers:
    api_router.include_router(router)

__all__ = ["api_router"]
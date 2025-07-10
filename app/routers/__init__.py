from fastapi import APIRouter

from . import admin, core, group, home, host, node, settings, subscription, system, user, user_template

api_router = APIRouter()

routers = [
    home.router,
    admin.router,
    system.router,
    settings.router,
    group.router,
    core.router,
    host.router,
    node.router,
    user.router,
    subscription.router,
    user_template.router,
]

for router in routers:
    api_router.include_router(router)

__all__ = ["api_router"]

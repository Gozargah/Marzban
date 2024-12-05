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
)

api_router = APIRouter()

routers = [
    home.router,
    admin.router,
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
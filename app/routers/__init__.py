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
    clash,
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
    home.router,
    clash.router,
]

for router in routers:
    api_router.include_router(router)

__all__ = ["api_router"]
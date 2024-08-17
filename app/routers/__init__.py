from fastapi import APIRouter
from . import (
    admin, 
    core, 
    home, 
    node, 
    subscription, 
    system, 
    user_template, 
    user
)

api_router = APIRouter()

routers = [
    admin.router,
    core.router,
    home.router,
    node.router,
    subscription.router,
    system.router,
    user_template.router,
    user.router,
]

for router in routers:
    api_router.include_router(router)

__all__ = ["api_router"]
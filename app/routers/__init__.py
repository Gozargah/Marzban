from fastapi import APIRouter
from . import (
    admin, 
    certificate, 
    core, 
    network, 
    nginx, 
    node, 
    subscription, 
    system, 
    user_template, 
    user,
    home,
)

api_router = APIRouter()

routers = [
    admin.router,
    certificate.router,
    core.router,
    network.router,
    nginx.router,
    node.router,
    subscription.router,
    system.router,
    user_template.router,
    user.router,
    home.router,
]

for router in routers:
    api_router.include_router(router)

__all__ = ["api_router"]
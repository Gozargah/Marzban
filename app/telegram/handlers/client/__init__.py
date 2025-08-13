from aiogram import Router
from . import show_info


router = Router(name="client")

router.include_router(show_info.router)

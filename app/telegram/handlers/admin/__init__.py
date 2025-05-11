from aiogram import Router
from . import main_menu, user, confirm_action


router = Router(name="admin")

router.include_router(main_menu.router)
router.include_router(confirm_action.router)

router.include_router(user.router)  # keep this as last one

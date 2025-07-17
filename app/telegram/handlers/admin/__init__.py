from aiogram import Router
from . import main_menu, user, confirm_action, bulk_actions


router = Router(name="admin")

router.include_router(main_menu.router)
router.include_router(confirm_action.router)
router.include_router(bulk_actions.router)

router.include_router(user.router)  # keep this as last one

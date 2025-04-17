from aiogram import Router
import importlib


router = Router(name="admin")

handlers = (
    "admin",
    "confirm_action",
    "user",
)


def init_handler() -> None:
    for name in handlers:
        importlib.import_module(f".{name}", "app.telegram.handlers.admin")

import pydoc
from typing import Union
import typer

from app.db import crud
from app.db.models import User

PASSWORD_ENVIRON_NAME = "MARZBAN_ADMIN_PASSWORD"

FLAGS: dict[str, tuple] = {
    "username": ("--username", "-u"),
    "limit": ("--limit", "-l"),
    "offset": ("--offset", "-o"),
    "yes_to_all": ("--yes", "-y"),
    "is_sudo": ("--sudo/--no-sudo",),
    "format": ("--format", "-f"),
    "output_file": ("--output", "-o")
}


def success(text: str, auto_exit: bool = True):
    typer.echo(typer.style(text, fg=typer.colors.GREEN))
    if auto_exit:
        raise typer.Exit(0)


def error(text: str, auto_exit: bool = True):
    typer.echo(typer.style(text, fg=typer.colors.RED), err=True)
    if auto_exit:
        raise typer.Exit(-1)


def paginate(text: str):
    pydoc.pager(text)


def get_user(db, username: str) -> User:
    user: Union[User, None] = crud.get_user(db=db, username=username)
    if not user:
        error(f'User "{username}" not found!')

    return user

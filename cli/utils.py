import pydoc
from datetime import datetime
from typing import Any, Dict, Iterable, Optional, TypeVar, Union

import typer
from rich.console import Console
from rich.table import Table

from app.db import crud
from app.db.models import User

T = TypeVar("T")

rich_console = Console()
PASSWORD_ENVIRON_NAME = "MARZBAN_ADMIN_PASSWORD"

FLAGS: Dict[str, tuple] = {
    "username": ("--username", "-u"),
    "search": ("--search", "-s"),
    "admin": ("--admin", "--owner"),
    "limit": ("--limit", "-l"),
    "offset": ("--offset", "-o"),
    "yes_to_all": ("--yes", "-y"),
    "is_sudo": ("--sudo/--no-sudo",),
    "format": ("--format", "-f"),
    "output_file": ("--output", "-o"),
    "status": ("--status",),
    "telegram_id": ("--telegram-id", "-tg"),
    "discord_webhook": ("--discord-webhook", "-dc"),
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


def print_table(
    table: Table,
    rows: Iterable[Iterable[Any]],
    console: Optional[Console] = None
):
    for row in rows:
        table.add_row(*row)

    (console or rich_console).print(table)


def readable_datetime(
    date_time: Union[datetime, int, None],
    include_date: bool = True,
    include_time: bool = True
):
    def get_datetime_format():
        dt_format = ""
        if include_date:
            dt_format += "%d %B %Y"
        if include_time:
            if dt_format:
                dt_format += ", "
            dt_format += "%H:%M:%S"

        return dt_format

    if isinstance(date_time, int):
        date_time = datetime.fromtimestamp(date_time)

    return date_time.strftime(get_datetime_format()) if date_time else "-"


def raise_if_falsy(obj: T, message: str) -> T:
    if not obj:
        error(text=message, auto_exit=True)

    return obj

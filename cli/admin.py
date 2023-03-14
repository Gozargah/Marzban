from typing import Optional, Union

import typer
from rich.table import Table
from rich.console import Console
from rich.panel import Panel
from sqlalchemy.exc import IntegrityError

from app.db import GetDB
from app.db import crud
from app.db.models import Admin
from app.models.admin import AdminCreate, AdminPartialModify
from . import utils

app = typer.Typer()
console = Console()

PASSWORD_ENVIRON_NAME = "MARZBAN_ADMIN_PASSWORD"

FLAGS = {
    "username": ("--username", "-u"),
    "limit": ("--limit", "-l"),
    "offset": ("--offset", "-o"),
    "yes_to_all": ("--yes", "-y"),
    "is_sudo": ("--sudo/--no-sudo",),
}


@app.command(name="list")
def list_admins(
    offset: Optional[int] = typer.Option(None, *FLAGS["offset"]),
    limit: Optional[int] = typer.Option(None, *FLAGS["limit"]),
    username: Optional[str] = typer.Option(None, *FLAGS["username"], help="Search by username"),
):
    with GetDB() as db:
        table = Table("Username", "Is sudo", "Created at")
        admins: list[Admin] = crud.get_admins(db, offset=offset, limit=limit, username=username)

        for admin in admins:
            table.add_row(
                str(admin.username),
                "✔️" if admin.is_sudo else "✖️",
                admin.created_at.strftime("%d %B %Y, %H:%M:%S")
            )

        console.print(table)


@app.command(name="delete")
def delete_admin(
    username: str = typer.Option(..., *FLAGS["username"], prompt=True),
    yes_to_all: bool = typer.Option(False, *FLAGS["yes_to_all"], help="Skips confirmation")
):
    with GetDB() as db:
        admin: Union[Admin, None] = crud.get_admin(db, username=username)
        if not admin:
            utils.error(f"There's no admin with username \"{username}\"!")

        if yes_to_all or typer.confirm(f'Are you sure about deleting "{username}"?', default=False):
            crud.remove_admin(db, admin)
            utils.success(f'"{username}" deleted successfully.')
        else:
            utils.error("Operation aborted!")


@app.command(name="create")
def create_admin(
    username: str = typer.Option(..., *FLAGS["username"], prompt=True),
    is_sudo: bool = typer.Option(False, *FLAGS["is_sudo"], prompt=True),
    password: str = typer.Option(..., prompt=True, confirmation_prompt=True,
                                 hide_input=True, hidden=True, envvar=PASSWORD_ENVIRON_NAME)
):
    with GetDB() as db:
        try:
            crud.create_admin(db, AdminCreate(username=username, password=password, is_sudo=is_sudo))
            utils.success(f'Admin "{username}" created successfully.')
        except IntegrityError:
            utils.error(f'Admin "{username}" already exists!')


@app.command(name="update")
def update_admin(username: str = typer.Option(..., *FLAGS["username"], prompt=True)):
    def _get_modify_model(admin: Admin):
        console.print(
            Panel(f'Editing "{username}". Just press "Enter" to leave each field unchanged.')
        )

        is_sudo: bool = typer.confirm("Is sudo", default=admin.is_sudo)
        new_password: Union[str, None] = typer.prompt(
            "New password",
            default="",
            show_default=False,
            confirmation_prompt=True,
            hide_input=True
        ) or None

        return AdminPartialModify(
            is_sudo=is_sudo,
            password=new_password,
        )

    with GetDB() as db:
        admin: Union[Admin, None] = crud.get_admin(db, username=username)
        if not admin:
            utils.error(f"There's no admin with username \"{username}\"!")

        crud.partial_update_admin(db, admin, _get_modify_model(admin))
        utils.success(f'Admin "{username}" updated successfully.')

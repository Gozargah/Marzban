from typing import Optional

import typer
from rich.table import Table

from app.db import GetDB, crud
from app.db.models import User
from app.utils.system import readable_size

from . import utils

app = typer.Typer(no_args_is_help=True)


@app.command(name="list")
def list_users(
    offset: Optional[int] = typer.Option(None, *utils.FLAGS["offset"]),
    limit: Optional[int] = typer.Option(None, *utils.FLAGS["limit"]),
    username: Optional[list[str]] = typer.Option(None, *utils.FLAGS["username"], help="Search by username(s)"),
    search: Optional[str] = typer.Option(None, *utils.FLAGS["search"], help="Search by username/note"),
    status: Optional[crud.UserStatus] = typer.Option(None, *utils.FLAGS["status"]),
    admins: Optional[list[str]] = typer.Option(None, *utils.FLAGS["admin"], help="Search by owner admin's username(s)")
):
    """
    Displays a table of users

    NOTE: Sorting is not currently available.
    """
    with GetDB() as db:
        users: list[User] = crud.get_users(
            db=db, offset=offset, limit=limit,
            usernames=username, search=search, status=status,
            admins=admins
        )

        utils.print_table(
            table=Table(
                "ID", "Username", "Status", "Used traffic",
                "Data limit", "Reset strategy", "Expires at", "Owner",
            ),
            rows=[
                (
                    str(user.id),
                    user.username,
                    user.status.value,
                    readable_size(user.used_traffic),
                    readable_size(user.data_limit) if user.data_limit else "Unlimited",
                    user.data_limit_reset_strategy.value,
                    utils.readable_datetime(user.expire, include_time=False),
                    user.admin.username if user.admin else ''
                )
                for user in users
            ]
        )


@app.command(name="set-owner")
def set_owner(
    username: str = typer.Option(None, *utils.FLAGS["username"], prompt=True),
    admin: str = typer.Option(None, "--admin", "--owner", prompt=True, help="Admin's username"),
    yes_to_all: bool = typer.Option(False, *utils.FLAGS["yes_to_all"], help="Skips confirmations")
):
    """
    Transfers user's ownership

    NOTE: This command needs additional confirmation for users who already have an owner.
    """
    with GetDB() as db:
        user: User = utils.raise_if_falsy(
            crud.get_user(db, username=username), f'User "{username}" not found.')

        dbadmin = utils.raise_if_falsy(
            crud.get_admin(db, username=admin), f'Admin "{admin}" not found.')

        # Ask for confirmation if user already has an owner
        if user.admin and not yes_to_all and not typer.confirm(
            f'{username}\'s current owner is "{user.admin.username}".'
            f' Are you sure about transferring its ownership to "{admin}"?'
        ):
            utils.error("Aborted.")

        crud.set_owner(db, user, dbadmin)

        utils.success(f'{username}\'s owner successfully set to "{admin}".')

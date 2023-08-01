from typing import Optional
from rich.table import Table

import typer

import time
from fastapi import BackgroundTasks
from app import xray
from app.db import GetDB
from app.db import crud
from app.db.models import User
from app.models.user import UserStatus
from app.utils.system import readable_size
from . import utils

app = typer.Typer(no_args_is_help=True)


@app.command(name="list")
def list_users(
    offset: Optional[int] = typer.Option(None, *utils.FLAGS["offset"]),
    limit: Optional[int] = typer.Option(None, *utils.FLAGS["limit"]),
    username: Optional[str] = typer.Option(None, *utils.FLAGS["username"], help="Search by username"),
    status: Optional[crud.UserStatus] = typer.Option(None, *utils.FLAGS["status"]),
    admin: Optional[str] = typer.Option(None, "--admin", "--owner", help="Search by owner admin's username")
):
    """
    Displays a table of users

    NOTE: Sorting is not currently available.
    """
    with GetDB() as db:
        users: list[User] = crud.get_users(
            db=db, offset=offset, limit=limit,
            username=username, status=status,
            admin=crud.get_admin(db, admin) if admin else None
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

        dbadmin: Admin = utils.raise_if_falsy(
            crud.get_admin(db, username=admin), f'Admin "{admin}" not found.')

        # Ask for confirmation if user already has an owner
        if user.admin and not yes_to_all and not typer.confirm(
            f'{username}\'s current owner is "{user.admin.username}".'
            f' Are you sure about transferring its ownership to "{admin}"?'
        ):
            utils.error("Aborted.")

        user.admin = dbadmin
        db.commit()

        utils.success(f'{username}\'s owner successfully set to "{admin}".')

@app.command(name="delete-expired")
def delete_expired(
    bg: BackgroundTasks,
    days_passed: int = typer.Option(
        None, min=0, 
        help="Number of days that should pass from expiration time to delete the user.", prompt=True
    ),
    yes_to_all: bool = typer.Option(False, *utils.FLAGS["yes_to_all"], help="Skips confirmations"),
):
    """
    Delete expired users

    NOTE: This command will delete all expired users that meet the specified number of days passed and can't be undone.
    """
    with GetDB() as db:
        all_users = crud.get_users(db, status=UserStatus.expired)

        timestamp = days_passed * 86400

        expired_users = [user for user in all_users if is_user_expired(user, time)]

        if not expired_users:
            utils.success("No expired users found.")
            return

        if not yes_to_all and not typer.confirm(f"Are you sure you want to delete {len(expired_users)} expired users?"):
            utils.error("Aborted.")
            
        for user in expired_users:
            crud.remove_user(db, user)
            bg.add_task(xray.operations.remove_user, dbuser=user)

        utils.success(f'All exipred users removed successfully .')


def is_user_expired(user: User, timestamp: int) -> bool:

    current_time = int(time.time())  
    expiration_threshold = current_time - timestamp 
    return user.expire <= expiration_threshold


@app.command(name="data-limit")
def change_data_limit(
    data: int = typer.Option(
        ..., 
        help="Amount to add or subtract from the data limit for all users."
             " Use a negative number to decrease the data limit.", 
        prompt=True
    ),
    yes_to_all: bool = typer.Option(False, *utils.FLAGS["yes_to_all"], help="Skips confirmations"),
):
    """
    Change Users' Data Limit

    This command allows you to increase or decrease the data limit for active users.
    You need to specify the amount to be added or subtracted from the data limit.
    The amount can be a positive or negative integer.
    Be cautious, as this operation can't be undone.

    Example usage:

    To increase the data limit for active users by 10 GB:
    marzban cli user data-limit
    Data: 10

    To decrease the data limit for active users by 5 GB:
    marzban cli user data-limit 
    Data: -5
    """

    with GetDB() as db:
        active_users = crud.get_users(db, status=UserStatus.active)

        data = data * (1024 ** 3)

        if not yes_to_all and not typer.confirm(f"Are you sure you want to modify the data limit for all users?"):
            utils.error("Aborted.")

        crud.update_users(db, active_users, data=data)              
        
        utils.success("Data limit updated for all users.")


@app.command(name="change-expire")
def change_expire(
    days: int = typer.Option(
        ..., 
        help="Number of days to add or subtract from the current expiration date for all users.",
        prompt=True
    ),
    yes_to_all: bool = typer.Option(False, *utils.FLAGS["yes_to_all"], help="Skips confirmations"),
):
    """
    Change Users' Expiration Date

    This command allows you to increase or decrease the expiration date for active users.
    You need to specify the number of days to be added or subtracted from the current expiration date.
    The amount can be a positive or negative integer.
    Be cautious, as this operation can't be undone.

    Example usage:

    To increase the expiration date for active users by 30 days:
    marzban cli user change-expire 
    days: 30

    To decrease the expiration date for active users by 15 days:
    marzban cli user change-expire 
    days: -15
    """
    with GetDB() as db:
        active_users = crud.get_users(db, status=UserStatus.active)

        timestamp = days * 86400

        if not yes_to_all and not typer.confirm(f"Are you sure you want to modify the expiration date for all users?"):
            utils.error("Aborted.")

        crud.update_users(db, active_users, time=timestamp)

        utils.success("Expiration date updated for all users.")

from typing import Optional, List

import typer
from rich.table import Table

from app.db import GetDB, crud
from app.db.models import User
from app.utils import hwid
from app.utils.system import readable_size

from . import utils

app = typer.Typer(no_args_is_help=True)


@app.command(name="list")
def list_users(
    offset: Optional[int] = typer.Option(None, *utils.FLAGS["offset"]),
    limit: Optional[int] = typer.Option(None, *utils.FLAGS["limit"]),
    username: Optional[List[str]] = typer.Option(None, *utils.FLAGS["username"], help="Search by username(s)"),
    search: Optional[str] = typer.Option(None, *utils.FLAGS["search"], help="Search by username/note"),
    status: Optional[crud.UserStatus] = typer.Option(None, *utils.FLAGS["status"]),
    admins: Optional[List[str]] = typer.Option(None, *utils.FLAGS["admin"], help="Search by owner admin's username(s)")
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


@app.command(name="devices")
def list_devices(
    username: str = typer.Option(None, *utils.FLAGS["username"], prompt=True),
):
    """
    Displays the devices that have fetched a user's subscription
    """
    with GetDB() as db:
        user: User = utils.get_user(db, username)
        devices = crud.get_user_devices(db, user)
        limit = hwid.effective_limit(user)

        typer.echo(
            f'{len(devices)} device(s) for "{username}", '
            + (f"limit {limit}." if limit else "no limit in force.")
        )

        utils.print_table(
            table=Table("ID", "Hardware ID", "OS", "Version", "Model", "First seen", "Last seen"),
            rows=[
                (
                    str(device.id),
                    device.hwid,
                    device.os or "-",
                    device.os_version or "-",
                    device.model or "-",
                    utils.readable_datetime(device.first_seen_at),
                    utils.readable_datetime(device.last_seen_at),
                )
                for device in devices
            ],
        )


@app.command(name="reset-devices")
def reset_devices(
    username: str = typer.Option(None, *utils.FLAGS["username"], prompt=True),
    device: Optional[int] = typer.Option(
        None, "--device", "-d", help="Forget only this device, by its ID"
    ),
    yes_to_all: bool = typer.Option(False, *utils.FLAGS["yes_to_all"], help="Skips confirmations"),
):
    """
    Forgets a user's devices, freeing their slots

    NOTE: A forgotten device keeps the configuration it already downloaded. What
    this frees is the right to fetch a new one; revoke the subscription to cut
    an existing device off.
    """
    with GetDB() as db:
        user: User = utils.get_user(db, username)

        if device is not None:
            dbdevice = utils.raise_if_falsy(
                crud.get_user_device(db, user, device),
                f'Device {device} does not belong to "{username}".',
            )
            crud.remove_user_device(db, dbdevice)
            utils.success(f'Device {device} forgotten for "{username}".')

        count = crud.count_user_devices(db, user)
        if not count:
            utils.success(f'"{username}" has no devices to forget.')

        if not yes_to_all and not typer.confirm(
            f'This forgets all {count} device(s) of "{username}". Are you sure?'
        ):
            utils.error("Aborted.")

        removed = crud.reset_user_devices(db, user)
        utils.success(f'{removed} device(s) forgotten for "{username}".')


@app.command(name="set-device-limit")
def set_device_limit(
    username: str = typer.Option(None, *utils.FLAGS["username"], prompt=True),
    limit: Optional[int] = typer.Option(
        None, "--limit", "-l", help="Devices allowed; 0 for no limit, omit to fall back to the panel default"
    ),
    default: bool = typer.Option(False, "--default", help="Clear the user's own limit"),
):
    """
    Sets how many devices may fetch a user's subscription

    A limit only applies to clients that report a hardware id. With one in
    force, a client that does not is refused — including a browser opening the
    subscription page.
    """
    if default and limit is not None:
        utils.error("--default and --limit cannot be given together.")
    if not default and limit is None:
        utils.error("Give a --limit, or --default to fall back to the panel setting.")

    with GetDB() as db:
        user: User = utils.get_user(db, username)
        # None clears it back to the panel default; the column is nullable and
        # that null is what "use the global setting" means.
        user.hwid_device_limit = None if default else limit
        db.commit()
        db.refresh(user)

        effective = hwid.effective_limit(user)
        utils.success(
            f'"{username}" is now limited to {effective} device(s).'
            if effective
            else f'"{username}" now has no device limit.'
        )

import typer
from enum import Enum
from typing import Optional
from rich.console import Console

from app.db import GetDB
from app.models.user import UserResponse
from app.subscription.share import generate_subscription

from . import utils

app = typer.Typer(no_args_is_help=True)
console = Console()


class ConfigFormat(str, Enum):
    v2ray = "v2ray"
    clash = "clash"


@app.command(name="get-link")
def get_link(
    username: str = typer.Option(..., *utils.FLAGS["username"], prompt=True)
):
    """
    Prints the given user's subscription link.

    NOTE: This command needs `XRAY_SUBSCRIPTION_URL_PREFIX` environment variable to be set
      in order to work correctly.
    """
    with GetDB() as db:
        user: UserResponse = UserResponse.model_validate(utils.get_user(db, username))
        print(user.subscription_url)


@app.command(name="get-config")
def get_config(
    username: str = typer.Option(..., *utils.FLAGS["username"], prompt=True),
    config_format: ConfigFormat = typer.Option(..., *utils.FLAGS["format"], prompt=True),
    output_file: Optional[str] = typer.Option(
        None, *utils.FLAGS["output_file"], help="Writes the generated config in the file if provided"
    ),
    as_base64: bool = typer.Option(
        False, "--base64", is_flag=True, help="Encodes output in base64 format if present"
    )
):
    """
    Generates a subscription config.

    Generates a subscription config for the given user in the given format.

    The output will be written in the output file when the `output-file` is present,
      otherwise will be shown in the terminal.
    """
    with GetDB() as db:
        user: UserResponse = UserResponse.model_validate(utils.get_user(db, username))
        conf: str = generate_subscription(
            user=user, config_format=config_format.name, as_base64=as_base64
        )

        if output_file:
            with open(output_file, "w") as out_file:
                out_file.write(conf)

            utils.success(
                f'{username}\'s configuration in "{config_format.value}" format'
                f' successfully save to "{output_file}".'
            )
        else:
            utils.success(
                'No output file specified.'
                f' using pager for {username}\'s config in "{config_format}" format.',
                auto_exit=False
            )
            utils.paginate(conf)

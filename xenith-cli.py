#!/usr/bin/env python3
import os  # noqa
import readline  # noqa
import sys  # noqa

sys.path.insert(0, os.getcwd())  # noqa

import typer
from typer._completion_shared import Shells

import cli.admin
import cli.subscription
import cli.user

app = typer.Typer(no_args_is_help=True, add_completion=False)
app.add_typer(cli.admin.app, name="admin")
app.add_typer(cli.subscription.app, name="subscription")
app.add_typer(cli.user.app, name="user")


# Hidden completion app
app_completion = typer.Typer(no_args_is_help=True, help="Generate and install completion scripts.", hidden=True)
app.add_typer(app_completion, name="completion")


def get_default_shell() -> Shells:
    shell = os.environ.get('SHELL')
    if shell:
        shell = shell.split('/')[-1]
        if shell in Shells.__members__:
            return getattr(Shells, shell)
    return Shells.bash


@app_completion.command(help="Show completion for the specified shell, to copy or customize it.")
def show(ctx: typer.Context, shell: Shells = typer.Option(None,
                                                          help="The shell to install completion for.",
                                                          case_sensitive=False)) -> None:
    if shell is None:
        shell = get_default_shell()
    typer.completion.show_callback(ctx, None, shell)


@app_completion.command(help="Install completion for the specified shell.")
def install(ctx: typer.Context, shell: Shells = typer.Option(None,
                                                             help="The shell to install completion for.",
                                                             case_sensitive=False)) -> None:
    if shell is None:
        shell = get_default_shell()
    typer.completion.install_callback(ctx, None, shell)


if __name__ == "__main__":
    typer.completion.completion_init()
    app(prog_name=os.environ.get('CLI_PROG_NAME'))

#!/usr/bin/env python3
import typer
import readline  # noqa
import cli.admin
import cli.user
import cli.subscription

app = typer.Typer(no_args_is_help=True)
app.add_typer(cli.admin.app, name="admin")
app.add_typer(cli.subscription.app, name="subscription")
app.add_typer(cli.user.app, name="user")


if __name__ == "__main__":
    app()

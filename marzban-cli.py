#!/usr/bin/env python3
import typer
import readline  # noqa
import cli.admin

app = typer.Typer(no_args_is_help=True)
app.add_typer(cli.admin.app, name="admin")


if __name__ == "__main__":
    app()

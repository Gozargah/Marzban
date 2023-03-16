from enum import Enum
from typing import Union
import typer


def success(text: str, auto_exit: bool = True):
    typer.echo(typer.style(text, fg=typer.colors.GREEN))
    if auto_exit:
        raise typer.Exit(0)


def error(text: str, auto_exit: bool = True):
    typer.echo(typer.style(text, fg=typer.colors.RED), err=True)
    if auto_exit:
        raise typer.Exit(-1)

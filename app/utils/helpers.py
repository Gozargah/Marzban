import re
import json
import html
from datetime import datetime as dt, timezone as tz
from typing import Union
from uuid import UUID

from pydantic import ValidationError


def yml_uuid_representer(dumper, data):
    return dumper.represent_scalar("tag:yaml.org,2002:str", str(data))


def readable_datetime(date_time: Union[dt, int, None], include_date: bool = True, include_time: bool = True):
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
        date_time = dt.fromtimestamp(date_time)

    return date_time.strftime(get_datetime_format()) if date_time else "-"


def fix_datetime_timezone(value: dt | int):
    if isinstance(value, dt):
        # If datetime is naive (no timezone), assume it's UTC
        if value.tzinfo is None:
            return value.replace(tzinfo=tz.utc)
        # If datetime has timezone, convert to UTC
        else:
            return value.astimezone(tz.utc)
    elif isinstance(value, int):
        # Timestamp will be assume it's UTC
        return dt.fromtimestamp(value, tz=tz.utc)

    raise ValueError("input can be datetime or timestamp")


class UUIDEncoder(json.JSONEncoder):
    def default(self, obj):
        if isinstance(obj, UUID):
            # if the obj is uuid, we simply return the value of uuid
            return str(obj)
        return super().default(self, obj)


def format_validation_error(error: ValidationError) -> str:
    return "\n".join([e["loc"][0].replace("_", " ").capitalize() + ": " + e["msg"] for e in error.errors()])


def format_cli_validation_error(errors: ValidationError, notify: callable):
    for error in errors.errors():
        for err in error["msg"].split(";"):
            notify(
                title=f"Error: {error['loc'][0].replace('_', ' ').capitalize()}",
                message=err.strip(),
                severity="error",
            )


def escape_tg_html(list: tuple[str]) -> tuple[str]:
    """Escapes HTML special characters for the telegram HTML parser."""
    return tuple(html.escape(text) for text in list)


def escape_ds_markdown(text: str) -> str:
    """Escapes markdown special characters for Discord."""
    # Other characters like >, |, [, ], (, ) are often handled by Discord's parser
    # or are part of specific markdown constructs (e.g., links, blockquotes)
    # that might not need general escaping.
    escape_chars = r"[*_`~]"
    return re.sub(escape_chars, r"\\\g<0>", text)


def escape_ds_markdown_list(list: tuple[str]) -> tuple[str]:
    """Escapes markdown special characters for Discord."""
    return tuple(escape_ds_markdown(text) for text in list)
    
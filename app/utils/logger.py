import logging
from copy import copy
from urllib.parse import unquote

import click
from uvicorn.config import LOGGING_CONFIG
from uvicorn.logging import DefaultFormatter

from config import (
    ECHO_SQL_QUERIES,
    LOG_BACKUP_COUNT,
    LOG_FILE_PATH,
    LOG_MAX_BYTES,
    LOG_ROTATION_ENABLED,
    LOG_ROTATION_INTERVAL,
    LOG_ROTATION_UNIT,
    SAVE_LOGS_TO_FILE,
)


class CustomLoggingFormatter(DefaultFormatter):
    def formatMessage(self, record: logging.LogRecord) -> str:
        recordcopy = copy(record)
        recordcopy.__dict__["nameprefix"] = click.style(record.name.capitalize(), fg="blue")
        return super().formatMessage(recordcopy)


LOGGING_CONFIG["formatters"]["custom"] = {
    "()": CustomLoggingFormatter,
    "fmt": "%(levelprefix)s %(asctime)s - %(nameprefix)s - %(message)s",
    "use_colors": None,
}
LOGGING_CONFIG["handlers"]["custom"] = {
    "class": LOGGING_CONFIG["handlers"]["default"]["class"],
    "formatter": "custom",
    "stream": LOGGING_CONFIG["handlers"]["default"]["stream"],
}

LOGGING_CONFIG["formatters"]["default"]["fmt"] = "%(levelprefix)s %(asctime)s - %(message)s"
LOGGING_CONFIG["formatters"]["access"]["fmt"] = (
    '%(levelprefix)s %(asctime)s - %(client_addr)s - "%(request_line)s" %(status_code)s'
)


if SAVE_LOGS_TO_FILE:
    if LOG_ROTATION_ENABLED:
        LOGGING_CONFIG["handlers"]["file"] = {
            "class": "logging.handlers.TimedRotatingFileHandler",
            "formatter": "default",
            "filename": LOG_FILE_PATH,
            "interval": LOG_ROTATION_INTERVAL,
            "when": LOG_ROTATION_UNIT,
            "backupCount": LOG_BACKUP_COUNT,
        }
    else:
        LOGGING_CONFIG["handlers"]["file"] = {
            "class": "logging.handlers.RotatingFileHandler",
            "formatter": "default",
            "filename": LOG_FILE_PATH,
            "maxBytes": LOG_MAX_BYTES,
            "backupCount": LOG_BACKUP_COUNT,
        }
    LOGGING_CONFIG["loggers"]["uvicorn"]["handlers"].append("file")
    LOGGING_CONFIG["loggers"]["uvicorn.access"]["handlers"].append("file")


def get_logger(name: str = "uvicorn.error") -> logging.Logger:
    if not LOGGING_CONFIG["loggers"].get(name):
        handlers = ["custom"]
        if SAVE_LOGS_TO_FILE:
            handlers.append("file")
        LOGGING_CONFIG["loggers"][name] = {
            "handlers": handlers,
            "level": LOGGING_CONFIG["loggers"]["uvicorn"]["level"],
        }
        logging.config.dictConfig(LOGGING_CONFIG)

    logger = logging.getLogger(name)
    return logger


if ECHO_SQL_QUERIES:
    _ = get_logger("sqlalchemy.engine")


class EndpointFilter(logging.Filter):
    def __init__(self, excluded_endpoints: list[str]):
        self.excluded_endpoints = excluded_endpoints

    def filter(self, record: logging.LogRecord) -> bool:
        if record.args and len(record.args) >= 2:
            path = unquote(record.args[2])
            return path not in self.excluded_endpoints
        return True

"""Optional JSON log formatter (stdlib only).

Activated by setting ``LOG_FORMAT=json`` in the environment. Default is
``text`` which preserves the current human-readable uvicorn formatter.

Emits one JSON object per line with these keys: ``ts`` (UTC ISO 8601
timestamp), ``level``, ``logger``, ``msg``, ``module``, ``func``,
``line``, plus an ``exc_info`` text block when present, plus any extra
keys passed via ``logger.info(..., extra={...})``.
"""

import datetime as _dt
import json
import logging
from typing import Final

_RESERVED_LOG_RECORD_KEYS: Final = frozenset({
    "name", "msg", "args", "levelname", "levelno", "pathname", "filename",
    "module", "exc_info", "exc_text", "stack_info", "lineno", "funcName",
    "created", "msecs", "relativeCreated", "thread", "threadName",
    "processName", "process", "message", "asctime", "taskName",
})


class JsonFormatter(logging.Formatter):
    def format(self, record: logging.LogRecord) -> str:  # noqa: D401
        payload = {
            "ts": _dt.datetime.fromtimestamp(record.created, tz=_dt.timezone.utc).isoformat(),
            "level": record.levelname,
            "logger": record.name,
            "msg": record.getMessage(),
            "module": record.module,
            "func": record.funcName,
            "line": record.lineno,
        }
        if record.exc_info:
            payload["exc_info"] = self.formatException(record.exc_info)
        if record.stack_info:
            payload["stack_info"] = record.stack_info
        # Surface any `extra={...}` keys the caller attached.
        for key, value in record.__dict__.items():
            if key in _RESERVED_LOG_RECORD_KEYS or key.startswith("_"):
                continue
            try:
                json.dumps(value)
            except (TypeError, ValueError):
                value = repr(value)
            payload[key] = value
        return json.dumps(payload, ensure_ascii=False)


def configure_json_logging() -> None:
    """Replace every existing logging.Handler's formatter with JsonFormatter.

    Safe to call multiple times — idempotent at the handler level (each
    handler ends up with the same JsonFormatter instance class). Does
    not add or remove handlers, only swaps their formatters; this keeps
    uvicorn's existing handler tree (access, error, default) intact.
    """
    formatter = JsonFormatter()
    for logger_name in (None, "uvicorn", "uvicorn.access", "uvicorn.error"):
        logger = logging.getLogger(logger_name) if logger_name else logging.root
        for handler in logger.handlers:
            handler.setFormatter(formatter)


def configure_logging(log_format: str) -> None:
    """Dispatch on LOG_FORMAT env var. `text` is a no-op."""
    if log_format == "json":
        configure_json_logging()

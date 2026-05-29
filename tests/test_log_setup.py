"""Tests for app.utils.log_setup — optional JSON log formatter."""

import io
import json
import logging

from app.utils.log_setup import JsonFormatter, configure_json_logging, configure_logging


def _captured_log_line(formatter, **kwargs) -> dict:
    """Format one log record through `formatter` and parse the resulting JSON."""
    logger = logging.getLogger(f"test.json.{id(formatter)}")
    logger.handlers.clear()
    logger.setLevel(logging.DEBUG)
    logger.propagate = False
    stream = io.StringIO()
    handler = logging.StreamHandler(stream)
    handler.setFormatter(formatter)
    logger.addHandler(handler)
    logger.info("hello %s", "world", **kwargs)
    return json.loads(stream.getvalue().strip())


def test_json_formatter_emits_required_keys():
    record = _captured_log_line(JsonFormatter())
    for key in ("ts", "level", "logger", "msg", "module", "func", "line"):
        assert key in record, f"missing key: {key}"
    assert record["level"] == "INFO"
    assert record["msg"] == "hello world"


def test_json_formatter_surfaces_extra_keys():
    record = _captured_log_line(
        JsonFormatter(), extra={"request_id": "abc-123", "user_id": 42}
    )
    assert record["request_id"] == "abc-123"
    assert record["user_id"] == 42


def test_json_formatter_attaches_exception_traceback():
    formatter = JsonFormatter()
    logger = logging.getLogger("test.json.exc")
    logger.handlers.clear()
    logger.setLevel(logging.DEBUG)
    logger.propagate = False
    stream = io.StringIO()
    handler = logging.StreamHandler(stream)
    handler.setFormatter(formatter)
    logger.addHandler(handler)

    try:
        raise RuntimeError("boom")
    except RuntimeError:
        logger.error("oh no", exc_info=True)

    record = json.loads(stream.getvalue().strip())
    assert "exc_info" in record
    assert "RuntimeError: boom" in record["exc_info"]


def test_configure_logging_text_is_noop():
    """LOG_FORMAT=text must not replace any existing formatter."""
    sentinel = logging.Formatter("%(message)s SENTINEL")
    handler = logging.StreamHandler()
    handler.setFormatter(sentinel)
    logging.root.addHandler(handler)
    try:
        configure_logging("text")
        assert handler.formatter is sentinel
    finally:
        logging.root.removeHandler(handler)


def test_configure_logging_json_replaces_formatter():
    handler = logging.StreamHandler()
    handler.setFormatter(logging.Formatter("%(message)s"))
    logging.root.addHandler(handler)
    try:
        configure_json_logging()
        assert isinstance(handler.formatter, JsonFormatter)
    finally:
        logging.root.removeHandler(handler)

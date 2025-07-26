import os

from decouple import config
from dotenv import load_dotenv

TESTING = os.getenv("TESTING", False)

if not TESTING:
    load_dotenv()


SQLALCHEMY_DATABASE_URL = config("SQLALCHEMY_DATABASE_URL", default="sqlite+aiosqlite:///db.sqlite3")
SQLALCHEMY_POOL_SIZE = config("SQLALCHEMY_POOL_SIZE", cast=int, default=10)
SQLALCHEMY_MAX_OVERFLOW = config("SQLIALCHEMY_MAX_OVERFLOW", cast=int, default=30)

UVICORN_HOST = config("UVICORN_HOST", default="0.0.0.0")
UVICORN_PORT = config("UVICORN_PORT", cast=int, default=8000)
UVICORN_UDS = config("UVICORN_UDS", default=None)
UVICORN_SSL_CERTFILE = config("UVICORN_SSL_CERTFILE", default=None)
UVICORN_SSL_KEYFILE = config("UVICORN_SSL_KEYFILE", default=None)
UVICORN_SSL_CA_TYPE = config("UVICORN_SSL_CA_TYPE", default="public").lower()
DASHBOARD_PATH = config("DASHBOARD_PATH", default="/dashboard/")

DEBUG = config("DEBUG", default=False, cast=bool)
DOCS = config("DOCS", default=False, cast=bool)

ALLOWED_ORIGINS = config("ALLOWED_ORIGINS", default="*").split(",")

VITE_BASE_API = (
    f"{'https' if UVICORN_SSL_CERTFILE and UVICORN_SSL_KEYFILE else 'http'}://127.0.0.1:{UVICORN_PORT}/"
    if DEBUG and config("VITE_BASE_API", default="/") == "/"
    else config("VITE_BASE_API", default="/")
)

# For backward compatibility
SUBSCRIPTION_PATH = config("XRAY_SUBSCRIPTION_PATH", default="").strip("/")
if not SUBSCRIPTION_PATH:
    SUBSCRIPTION_PATH = config("SUBSCRIPTION_PATH", default="sub").strip("/")

USER_SUBSCRIPTION_CLIENTS_LIMIT = config("USER_SUBSCRIPTION_CLIENTS_LIMIT", cast=int, default=10)

JWT_ACCESS_TOKEN_EXPIRE_MINUTES = config("JWT_ACCESS_TOKEN_EXPIRE_MINUTES", cast=int, default=1440)

CUSTOM_TEMPLATES_DIRECTORY = config("CUSTOM_TEMPLATES_DIRECTORY", default=None)
SUBSCRIPTION_PAGE_TEMPLATE = config("SUBSCRIPTION_PAGE_TEMPLATE", default="subscription/index.html")
HOME_PAGE_TEMPLATE = config("HOME_PAGE_TEMPLATE", default="home/index.html")

CLASH_SUBSCRIPTION_TEMPLATE = config("CLASH_SUBSCRIPTION_TEMPLATE", default="clash/default.yml")

SINGBOX_SUBSCRIPTION_TEMPLATE = config("SINGBOX_SUBSCRIPTION_TEMPLATE", default="singbox/default.json")

XRAY_SUBSCRIPTION_TEMPLATE = config("XRAY_SUBSCRIPTION_TEMPLATE", default="xray/default.json")

USER_AGENT_TEMPLATE = config("USER_AGENT_TEMPLATE", default="user_agent/default.json")
GRPC_USER_AGENT_TEMPLATE = config("GRPC_USER_AGENT_TEMPLATE", default="user_agent/grpc.json")

EXTERNAL_CONFIG = config("EXTERNAL_CONFIG", default="", cast=str)

USERS_AUTODELETE_DAYS = config("USERS_AUTODELETE_DAYS", default=-1, cast=int)
USER_AUTODELETE_INCLUDE_LIMITED_ACCOUNTS = config("USER_AUTODELETE_INCLUDE_LIMITED_ACCOUNTS", default=False, cast=bool)

DO_NOT_LOG_TELEGRAM_BOT = config("DO_NOT_LOG_TELEGRAM_BOT", default=True, cast=bool)

# USERNAME: PASSWORD
SUDOERS = (
    {config("SUDO_USERNAME"): config("SUDO_PASSWORD")}
    if config("SUDO_USERNAME", default="") and config("SUDO_PASSWORD", default="")
    else {}
)

DISABLE_RECORDING_NODE_USAGE = config("DISABLE_RECORDING_NODE_USAGE", cast=bool, default=False)

# due to high amout of data this job is only available for postgresql and timescaledb
if SQLALCHEMY_DATABASE_URL.startswith("postgresql"):
    ENABLE_RECORDING_NODES_STATS = config("ENABLE_RECORDING_NODES_STATS", cast=bool, default=False)
else:
    ENABLE_RECORDING_NODES_STATS = False

# Interval jobs, all values are in seconds
JOB_CORE_HEALTH_CHECK_INTERVAL = config("JOB_CORE_HEALTH_CHECK_INTERVAL", cast=int, default=10)
JOB_RECORD_NODE_USAGES_INTERVAL = config("JOB_RECORD_NODE_USAGES_INTERVAL", cast=int, default=30)
JOB_RECORD_USER_USAGES_INTERVAL = config("JOB_RECORD_USER_USAGES_INTERVAL", cast=int, default=10)
JOB_REVIEW_USERS_INTERVAL = config("JOB_REVIEW_USERS_INTERVAL", cast=int, default=30)
JOB_SEND_NOTIFICATIONS_INTERVAL = config("JOB_SEND_NOTIFICATIONS_INTERVAL", cast=int, default=30)
JOB_GHATER_NODES_STATS_INTERVAL = config("JOB_GHATER_NODES_STATS_INTERVAL", cast=int, default=25)
JOB_REMOVE_OLD_INBOUNDS_INTERVAL = config("JOB_REMOVE_OLD_INBOUNDS_INTERVAL", cast=int, default=600)
JOB_REMOVE_EXPIRED_USERS_INTERVAL = config("JOB_REMOVE_EXPIRED_USERS_INTERVAL", cast=int, default=3600)
JOB_RESET_USER_DATA_USAGE_INTERVAL = config("JOB_RESET_USER_DATA_USAGE_INTERVAL", cast=int, default=600)

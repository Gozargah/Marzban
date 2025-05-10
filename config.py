from decouple import config
from dotenv import load_dotenv
import os


TESTING = os.getenv("TESTING", False)

if not TESTING:
    load_dotenv()


SQLALCHEMY_DATABASE_URL = config("SQLALCHEMY_DATABASE_URL", default="sqlite+aiosqlite:///db.sqlite3")
SQLALCHEMY_POOL_SIZE = config("SQLALCHEMY_POOL_SIZE", cast=int, default=10)
SQLIALCHEMY_MAX_OVERFLOW = config("SQLIALCHEMY_MAX_OVERFLOW", cast=int, default=30)

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

XRAY_JSON = config("XRAY_JSON", default="./xray_config.json")
XRAY_FALLBACKS_INBOUND_TAGS = config(
    "XRAY_FALLBACKS_INBOUND_TAG", cast=lambda v: [tag.strip() for tag in v.split(",")] if v else [], default=""
)
XRAY_EXCLUDE_INBOUND_TAGS = config("XRAY_EXCLUDE_INBOUND_TAGS", default="").split()
XRAY_SUBSCRIPTION_URL_PREFIX = config("XRAY_SUBSCRIPTION_URL_PREFIX", default="").strip("/")
XRAY_SUBSCRIPTION_PATH = config("XRAY_SUBSCRIPTION_PATH", default="sub").strip("/")

# Filter hosts based on user status
HOST_STATUS_FILTER = config("HOST_STATUS_FILTER", default=False, cast=bool)

# Telegram
TELEGRAM_API_TOKEN = config("TELEGRAM_API_TOKEN", default="")
TELEGRAM_WEBHOOK_URL = config("TELEGRAM_WEBHOOK_URL", default="").strip("/")
TELEGRAM_WEBHOOK_SECRET_KEY = config("TELEGRAM_WEBHOOK_SECRET_KEY", default=None)
TELEGRAM_ADMIN_ID = config(
    "TELEGRAM_ADMIN_ID", default="", cast=lambda v: int(v.split(",")[0].strip()) if v.strip() else None
)
TELEGRAM_PROXY_URL = config("TELEGRAM_PROXY_URL", default=None)
TELEGRAM_LOGGER_CHANNEL_ID = config("TELEGRAM_LOGGER_CHANNEL_ID", cast=int, default=0)
TELEGRAM_LOGGER_TOPIC_ID = config("TELEGRAM_LOGGER_TOPIC_ID", cast=int, default=0)
TELEGRAM_NOTIFY = config("TELEGRAM_NOTIFY", cast=bool, default=False)

NOTIFICATION_PROXY_URL = config("NOTIFICATION_PROXY_URL", default=None)

JWT_ACCESS_TOKEN_EXPIRE_MINUTES = config("JWT_ACCESS_TOKEN_EXPIRE_MINUTES", cast=int, default=1440)

CUSTOM_TEMPLATES_DIRECTORY = config("CUSTOM_TEMPLATES_DIRECTORY", default=None)
SUBSCRIPTION_PAGE_TEMPLATE = config("SUBSCRIPTION_PAGE_TEMPLATE", default="subscription/index.html")
HOME_PAGE_TEMPLATE = config("HOME_PAGE_TEMPLATE", default="home/index.html")

CLASH_SUBSCRIPTION_TEMPLATE = config("CLASH_SUBSCRIPTION_TEMPLATE", default="clash/default.yml")

SINGBOX_SUBSCRIPTION_TEMPLATE = config("SINGBOX_SUBSCRIPTION_TEMPLATE", default="singbox/default.json")

V2RAY_SUBSCRIPTION_TEMPLATE = config("V2RAY_SUBSCRIPTION_TEMPLATE", default="v2ray/default.json")

USER_AGENT_TEMPLATE = config("USER_AGENT_TEMPLATE", default="user_agent/default.json")
GRPC_USER_AGENT_TEMPLATE = config("GRPC_USER_AGENT_TEMPLATE", default="user_agent/grpc.json")

EXTERNAL_CONFIG = config("EXTERNAL_CONFIG", default="", cast=str)
LOGIN_NOTIFY_WHITE_LIST = [
    ip.strip() for ip in config("LOGIN_NOTIFY_WHITE_LIST", default="", cast=str).split(",") if ip.strip()
]

USE_CUSTOM_JSON_DEFAULT = config("USE_CUSTOM_JSON_DEFAULT", default=False, cast=bool)
USE_CUSTOM_JSON_FOR_V2RAYN = config("USE_CUSTOM_JSON_FOR_V2RAYN", default=False, cast=bool)
USE_CUSTOM_JSON_FOR_V2RAYNG = config("USE_CUSTOM_JSON_FOR_V2RAYNG", default=False, cast=bool)
USE_CUSTOM_JSON_FOR_STREISAND = config("USE_CUSTOM_JSON_FOR_STREISAND", default=False, cast=bool)
USE_CUSTOM_JSON_FOR_HAPP = config("USE_CUSTOM_JSON_FOR_HAPP", default=False, cast=bool)
USE_CUSTOM_JSON_FOR_NPVTUNNEL = config("USE_CUSTOM_JSON_FOR_NPVTUNNEL", default=False, cast=bool)

USERS_AUTODELETE_DAYS = config("USERS_AUTODELETE_DAYS", default=-1, cast=int)
USER_AUTODELETE_INCLUDE_LIMITED_ACCOUNTS = config("USER_AUTODELETE_INCLUDE_LIMITED_ACCOUNTS", default=False, cast=bool)


# USERNAME: PASSWORD
SUDOERS = (
    {config("SUDO_USERNAME"): config("SUDO_PASSWORD")}
    if config("SUDO_USERNAME", default="") and config("SUDO_PASSWORD", default="")
    else {}
)


WEBHOOK_ADDRESS = config(
    "WEBHOOK_ADDRESS", default="", cast=lambda v: [address.strip() for address in v.split(",")] if v else []
)
WEBHOOK_SECRET = config("WEBHOOK_SECRET", default=None)
WEBHOOK_PROXY_URL = config("WEBHOOK_PROXY_URL", default=None)

# recurrent notifications

# timeout between each retry of sending a notification in seconds
RECURRENT_NOTIFICATIONS_TIMEOUT = config("RECURRENT_NOTIFICATIONS_TIMEOUT", default=180, cast=int)
# how many times to try after ok response not recevied after sending a notifications
NUMBER_OF_RECURRENT_NOTIFICATIONS = config("NUMBER_OF_RECURRENT_NOTIFICATIONS", default=3, cast=int)

# sends a notification when the user uses this much of thier data
NOTIFY_REACHED_USAGE_PERCENT = config(
    "NOTIFY_REACHED_USAGE_PERCENT", default="80", cast=lambda v: [int(p.strip()) for p in v.split(",")] if v else []
)

# sends a notification when there is n days left of their service
NOTIFY_DAYS_LEFT = config(
    "NOTIFY_DAYS_LEFT", default="3", cast=lambda v: [int(d.strip()) for d in v.split(",")] if v else []
)

DISABLE_RECORDING_NODE_USAGE = config("DISABLE_RECORDING_NODE_USAGE", cast=bool, default=False)

# headers: profile-update-interval, support-url, profile-title
SUB_UPDATE_INTERVAL = config("SUB_UPDATE_INTERVAL", default="12")
SUB_SUPPORT_URL = config("SUB_SUPPORT_URL", default="https://t.me/")
SUB_PROFILE_TITLE = config("SUB_PROFILE_TITLE", default="Subscription")

# discord webhook log
DISCORD_WEBHOOK_URL = config("DISCORD_WEBHOOK_URL", default="")


# due to high amout of data this job is only available for postgresql and timescaledb
if SQLALCHEMY_DATABASE_URL.startswith("postgresql"):
    ENABLE_RECORDING_NODES_STATS = config("ENABLE_RECORDING_NODES_STATS", cast=bool, default=False)
else:
    ENABLE_RECORDING_NODES_STATS = False

# Interval jobs, all values are in seconds
JOB_CORE_HEALTH_CHECK_INTERVAL = config("JOB_CORE_HEALTH_CHECK_INTERVAL", cast=int, default=10)
JOB_RECORD_NODE_USAGES_INTERVAL = config("JOB_RECORD_NODE_USAGES_INTERVAL", cast=int, default=30)
JOB_RECORD_USER_USAGES_INTERVAL = config("JOB_RECORD_USER_USAGES_INTERVAL", cast=int, default=10)
JOB_REVIEW_USERS_INTERVAL = config("JOB_REVIEW_USERS_INTERVAL", cast=int, default=10)
JOB_SEND_NOTIFICATIONS_INTERVAL = config("JOB_SEND_NOTIFICATIONS_INTERVAL", cast=int, default=30)
JOB_GHATER_NODES_STATS_INTERVAL = config("JOB_GHATER_NODES_STATS_INTERVAL", cast=int, default=25)
JOB_REMOVE_OLD_INBOUNDS_INTERVAL = config("JOB_REMOVE_OLD_INBOUNDS_INTERVAL", cast=int, default=600)

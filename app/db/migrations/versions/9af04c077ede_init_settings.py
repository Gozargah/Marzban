"""init settings

Revision ID: 9af04c077ede
Revises: beb47f520963
Create Date: 2025-05-08 19:01:36.454848

"""
from alembic import op
import sqlalchemy as sa
from decouple import config as decouple_config


# revision identifiers, used by Alembic.
revision = "9af04c077ede"
down_revision = "beb47f520963"
branch_labels = None
depends_on = None


# Define a function to mimic config behavior but directly from environment
def get_config(key, default=None, cast=None):
    if cast is not None:
        return decouple_config(key, default=default, cast=cast)
    else:
        return decouple_config(key, default=default)


# Environment variables management
TELEGRAM_API_TOKEN = get_config("TELEGRAM_API_TOKEN", default="")
TELEGRAM_WEBHOOK_URL = get_config("TELEGRAM_WEBHOOK_URL", default="").strip("/")
TELEGRAM_WEBHOOK_SECRET_KEY = get_config("TELEGRAM_WEBHOOK_SECRET_KEY", default=None)
TELEGRAM_ADMIN_ID = get_config(
    "TELEGRAM_ADMIN_ID", default="", cast=lambda v: int(v.split(",")[0].strip()) if v.strip() else None
)
TELEGRAM_PROXY_URL = get_config("TELEGRAM_PROXY_URL", default=None)
TELEGRAM_LOGGER_CHANNEL_ID = get_config("TELEGRAM_LOGGER_CHANNEL_ID", cast=int, default=0)
TELEGRAM_LOGGER_TOPIC_ID = get_config("TELEGRAM_LOGGER_TOPIC_ID", cast=int, default=0)
TELEGRAM_NOTIFY = get_config("TELEGRAM_NOTIFY", cast=bool, default=False)

WEBHOOK_ADDRESS = get_config(
    "WEBHOOK_ADDRESS", default="", cast=lambda v: [address.strip() for address in v.split(",")] if v else []
)
WEBHOOK_SECRET = get_config("WEBHOOK_SECRET", default=None)
WEBHOOK_PROXY_URL = get_config("WEBHOOK_PROXY_URL", default=None)

NOTIFICATION_PROXY_URL = get_config("NOTIFICATION_PROXY_URL", default=None)

# recurrent notifications
RECURRENT_NOTIFICATIONS_TIMEOUT = get_config("RECURRENT_NOTIFICATIONS_TIMEOUT", default=180, cast=int)
NUMBER_OF_RECURRENT_NOTIFICATIONS = get_config("NUMBER_OF_RECURRENT_NOTIFICATIONS", default=3, cast=int)

# Notification thresholds
NOTIFY_REACHED_USAGE_PERCENT = get_config(
    "NOTIFY_REACHED_USAGE_PERCENT", default="80", cast=lambda v: [int(p.strip()) for p in v.split(",")] if v else []
)
NOTIFY_DAYS_LEFT = get_config(
    "NOTIFY_DAYS_LEFT", default="3", cast=lambda v: [int(d.strip()) for d in v.split(",")] if v else []
)

# Discord webhook
DISCORD_WEBHOOK_URL = get_config("DISCORD_WEBHOOK_URL", default="")

# Subscription settings
XRAY_SUBSCRIPTION_URL_PREFIX = get_config("XRAY_SUBSCRIPTION_URL_PREFIX", default="").strip("/")
SUB_UPDATE_INTERVAL = get_config("SUB_UPDATE_INTERVAL", default="12")
SUB_SUPPORT_URL = get_config("SUB_SUPPORT_URL", default="https://t.me/")
SUB_PROFILE_TITLE = get_config("SUB_PROFILE_TITLE", default="Subscription")
HOST_STATUS_FILTER = get_config("HOST_STATUS_FILTER", default=True, cast=bool)

# Custom JSON settings
USE_CUSTOM_JSON_DEFAULT = get_config("USE_CUSTOM_JSON_DEFAULT", default=False, cast=bool)
USE_CUSTOM_JSON_FOR_V2RAYN = get_config("USE_CUSTOM_JSON_FOR_V2RAYN", default=False, cast=bool)
USE_CUSTOM_JSON_FOR_V2RAYNG = get_config("USE_CUSTOM_JSON_FOR_V2RAYNG", default=False, cast=bool)
USE_CUSTOM_JSON_FOR_STREISAND = get_config("USE_CUSTOM_JSON_FOR_STREISAND", default=False, cast=bool)
USE_CUSTOM_JSON_FOR_HAPP = get_config("USE_CUSTOM_JSON_FOR_HAPP", default=False, cast=bool)
USE_CUSTOM_JSON_FOR_NPVTUNNEL = get_config("USE_CUSTOM_JSON_FOR_NPVTUNNEL", default=False, cast=bool)


# Build settings dictionaries
telegram = {
    "enable": True if TELEGRAM_API_TOKEN and TELEGRAM_WEBHOOK_URL and TELEGRAM_WEBHOOK_SECRET_KEY else False,
    "token": TELEGRAM_API_TOKEN if TELEGRAM_API_TOKEN else None,
    "webhook_url": TELEGRAM_WEBHOOK_URL if TELEGRAM_WEBHOOK_URL else None,
    "webhook_secret": TELEGRAM_WEBHOOK_SECRET_KEY if TELEGRAM_WEBHOOK_SECRET_KEY else None,
    "proxy_url": TELEGRAM_PROXY_URL,
}

discord = {"enable": False, "token": None, "proxy_url": None}

webhook = {
    "enable": True if WEBHOOK_ADDRESS else False,
    "webhooks": [{"url": url, "secret": WEBHOOK_SECRET} for url in WEBHOOK_ADDRESS],
    "days_left": NOTIFY_DAYS_LEFT,
    "usage_percent": NOTIFY_REACHED_USAGE_PERCENT,
    "timeout": RECURRENT_NOTIFICATIONS_TIMEOUT,
    "recurrent": NUMBER_OF_RECURRENT_NOTIFICATIONS,
    "proxy_url": WEBHOOK_PROXY_URL,
}

notification_settings = {
    "notify_telegram": TELEGRAM_NOTIFY,
    "notify_discord": True if DISCORD_WEBHOOK_URL else False,

    "telegram_api_token": TELEGRAM_API_TOKEN if TELEGRAM_API_TOKEN else None,
    "telegram_admin_id": TELEGRAM_ADMIN_ID if TELEGRAM_ADMIN_ID else None,
    "telegram_channel_id": TELEGRAM_LOGGER_CHANNEL_ID if TELEGRAM_LOGGER_CHANNEL_ID else None,
    "telegram_topic_id": TELEGRAM_LOGGER_TOPIC_ID if TELEGRAM_LOGGER_TOPIC_ID else None,

    "discord_webhook_url": DISCORD_WEBHOOK_URL if DISCORD_WEBHOOK_URL else None,

    "proxy_url": NOTIFICATION_PROXY_URL,

    "max_retries": 3,
}

notification_enable = {
    "admin": True,
    "core": True,
    "group": True,
    "host": True,
    "login": True,
    "node": True,
    "user": True,
    "user_template": True,
    "days_left": True,
    "percentage_reached": True,
}

xray_rule = ""

def append_rule(pattern: str) -> None:
    global xray_rule
    if xray_rule:
        xray_rule += "|" + pattern
    else:
        xray_rule = pattern

if USE_CUSTOM_JSON_DEFAULT:
    append_rule("[Vv]2rayNG")
    append_rule("[Vv]2rayN")
    append_rule("[Ss]treisand")
    append_rule("[Hh]app")
    append_rule(r"[Kk]tor\-client")

else:
    if USE_CUSTOM_JSON_FOR_V2RAYNG:
        append_rule("[Vv]2rayNG")
    if USE_CUSTOM_JSON_FOR_V2RAYN:
        append_rule("[Vv]2rayN")
    if USE_CUSTOM_JSON_FOR_STREISAND:
        append_rule("[Ss]treisand")
    if USE_CUSTOM_JSON_FOR_HAPP:
        append_rule("[Hh]app")
    if USE_CUSTOM_JSON_FOR_NPVTUNNEL:
        append_rule(r"[Kk]tor\-client")


rules = [
    {
        "pattern": r"^([Cc]lash[\-\.]?[Vv]erge|[Cc]lash[\-\.]?[Mm]eta|[Ff][Ll][Cc]lash|[Mm]ihomo)",
        "target": "clash_meta"
    },
    {
        "pattern": r"^([Cc]lash|[Ss]tash)",
        "target": "clash"
    },
    {
        "pattern": r"^(SFA|SFI|SFM|SFT|[Kk]aring|[Hh]iddify[Nn]ext)|.*[Ss]ing[\-b]?ox.*",
        "target": "sing_box"
    },
    {
        "pattern": r"^(SS|SSR|SSD|SSS|Outline|Shadowsocks|SSconf)",
        "target": "outline"
    },
    {
        "pattern": r"^.*",  # Default catch-all pattern
        "target": "links_base64"
    }
]

if xray_rule:
    rules.insert(-1, {"pattern": r"^(%s)" % xray_rule, "target": "xray"})

manual_sub_request = {
    "links": True,
    "links_base64": True,
    "xray": True,
    "sing_box": True,
    "clash": True,
    "clash_meta": True,
    "outline": True,
}

subscription = {
    "url_prefix": XRAY_SUBSCRIPTION_URL_PREFIX,
    "update_interval": SUB_UPDATE_INTERVAL,
    "support_url": SUB_SUPPORT_URL,
    "profile_title": SUB_PROFILE_TITLE,

    "host_status_filter": HOST_STATUS_FILTER,

    "rules": rules,
    "manual_sub_request": manual_sub_request
}

base_settings = {
    "telegram": telegram,
    "discord": discord,
    "webhook": webhook,
    "notification_settings": notification_settings,
    "notification_enable": notification_enable,
    "subscription": subscription,
}
def upgrade() -> None:
    # ### commands auto generated by Alembic - please adjust! ###
    op.create_table("settings",
    sa.Column("id", sa.Integer(), nullable=False),
    sa.Column("telegram", sa.JSON(), nullable=False),
    sa.Column("discord", sa.JSON(), nullable=False),
    sa.Column("webhook", sa.JSON(), nullable=False),
    sa.Column("notification_settings", sa.JSON(), nullable=False),
    sa.Column("notification_enable", sa.JSON(), nullable=False),
    sa.Column("subscription", sa.JSON(), nullable=False),
    sa.PrimaryKeyConstraint("id")
    )
    # ### end Alembic commands ###

    op.bulk_insert(
        sa.table(
            "settings",
            sa.Column("id", sa.Integer),
            sa.Column("telegram", sa.JSON),
            sa.Column("discord", sa.JSON),
            sa.Column("webhook", sa.JSON),
            sa.Column("notification_settings", sa.JSON),
            sa.Column("notification_enable", sa.JSON),
            sa.Column("subscription", sa.JSON)
        ),
        [
            base_settings
        ],
    )


def downgrade() -> None:
    # ### commands auto generated by Alembic - please adjust! ###
    op.drop_table("settings")
    # ### end Alembic commands ###

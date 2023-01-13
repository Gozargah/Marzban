import requests
from decouple import config
from dotenv import load_dotenv

load_dotenv()


# Disable IPv6
requests.packages.urllib3.util.connection.HAS_IPV6 = False

SERVER_IP = requests.get("https://ifconfig.io/ip").text.strip()


SQLALCHEMY_DATABASE_URL = config("SQLALCHEMY_DATABASE_URL", default="sqlite:///db.sqlite3")


UVICORN_HOST = config("UVICORN_HOST", default="127.0.0.1")
UVICORN_PORT = config("UVICORN_PORT", cast=int, default=8000)
UVICORN_UDS = config("UVICORN_UDS", default=None)
UVICORN_SSL_CERTFILE = config("UVICORN_SSL_CERTFILE", default=None)
UVICORN_SSL_KEYFILE = config("UVICORN_SSL_KEYFILE", default=None)


DEBUG = config("DEBUG", default=False, cast=bool)
DOCS = config("DOCS", default=True, cast=bool)


XRAY_JSON = config("XRAY_JSON", default="./xray.json")
XRAY_FALLBACK_INBOUND_TAG = config("XRAY_FALLBACK_INBOUND_TAG", cast=str, default="")
XRAY_EXECUTABLE_PATH = config("XRAY_EXECUTABLE_PATH", default="/usr/local/bin/xray")
XRAY_ASSETS_PATH = config("XRAY_ASSETS_PATH", default="/usr/local/share/xray")
XRAY_HOSTS = [
    {
        "remark": h.rsplit('@', 1)[0].format(SERVER_IP=SERVER_IP),
        "hostname": h.rsplit('@', 1)[1].format(SERVER_IP=SERVER_IP)
    }
    for h in filter(bool, config("XRAY_HOSTS", default=f'🚀 Marz@{SERVER_IP}').split("\n"))
]
XRAY_EXCLUDE_INBOUND_TAGS = config("XRAY_EXCLUDE_INBOUND_TAGS", default='').split()
XRAY_SUBSCRIPTION_URL_PREFIX = config("XRAY_SUBSCRIPTION_URL_PREFIX", default="").strip("/")


JWT_ACCESS_TOKEN_EXPIRE_MINUTES = config("JWT_ACCESS_TOKEN_EXPIRE_MINUTES", cast=int, default=1440)


# USERNAME: PASSWORD
SUDOERS = {
    config("SUDO_USERNAME", default="admin"): config("SUDO_PASSWORD", default="admin")
}

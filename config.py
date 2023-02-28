import requests
from decouple import config
from dotenv import load_dotenv
import json

load_dotenv(override=True)


def _render_xray_host_line(host_line: str, server_ip: str = ""):
    try:
        host_line_dict = json.loads(host_line)
        return {
            "remark": host_line_dict.get("remark", "").format(SERVER_IP=server_ip),
            "address": host_line_dict.get("address", "").format(SERVER_IP=server_ip),
            "sni": host_line_dict.get("sni", "").format(SERVER_IP=server_ip),
            "host": host_line_dict.get("host", "").format(SERVER_IP=server_ip),
        }
    except json.JSONDecodeError:
        pass  # fallback to simple "remark@address" syntax

    remark, address = host_line.rsplit("@", 1)
    return {
        "remark": remark.format(SERVER_IP=server_ip),
        "address": address.format(SERVER_IP=server_ip),
        "sni": "",
        "host": ""
    }


# Disable IPv6
requests.packages.urllib3.util.connection.HAS_IPV6 = False

SERVER_IP = requests.get("https://ifconfig.io/ip").text.strip()


SQLALCHEMY_DATABASE_URL = config("SQLALCHEMY_DATABASE_URL", default="sqlite:///db.sqlite3")


UVICORN_HOST = config("UVICORN_HOST", default="0.0.0.0")
UVICORN_PORT = config("UVICORN_PORT", cast=int, default=8000)
UVICORN_UDS = config("UVICORN_UDS", default=None)
UVICORN_SSL_CERTFILE = config("UVICORN_SSL_CERTFILE", default=None)
UVICORN_SSL_KEYFILE = config("UVICORN_SSL_KEYFILE", default=None)


DEBUG = config("DEBUG", default=False, cast=bool)
DOCS = config("DOCS", default=False, cast=bool)


XRAY_JSON = config("XRAY_JSON", default="./xray.json")
XRAY_FALLBACK_INBOUND_TAG = config("XRAY_FALLBACK_INBOUND_TAG", cast=str, default="")
XRAY_EXECUTABLE_PATH = config("XRAY_EXECUTABLE_PATH", default="/usr/local/bin/xray")
XRAY_ASSETS_PATH = config("XRAY_ASSETS_PATH", default="/usr/local/share/xray")
XRAY_HOSTS = [
    _render_xray_host_line(host_line, SERVER_IP)
    for host_line in map(str.strip, config("XRAY_HOSTS", default=f'🚀 Marz@{SERVER_IP}').split("\n"))
    if host_line and not host_line.startswith("#")
]
XRAY_EXCLUDE_INBOUND_TAGS = config("XRAY_EXCLUDE_INBOUND_TAGS", default='').split()
XRAY_SUBSCRIPTION_URL_PREFIX = config("XRAY_SUBSCRIPTION_URL_PREFIX", default="").strip("/")


TELEGRAM_API_TOKEN = config("TELEGRAM_API_TOKEN", default=None)
TELEGRAM_ADMIN_ID = config("TELEGRAM_ADMIN_ID", cast=int, default=0)
TELEGRAM_PROXY_URL = config("TELEGRAM_PROXY_URL", default=None)

JWT_ACCESS_TOKEN_EXPIRE_MINUTES = config("JWT_ACCESS_TOKEN_EXPIRE_MINUTES", cast=int, default=1440)


# USERNAME: PASSWORD
SUDOERS = {
    config("SUDO_USERNAME", default="admin"): config("SUDO_PASSWORD", default="admin")
}

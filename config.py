import requests
from decouple import config
from dotenv import load_dotenv

load_dotenv()


# Disable IPv6
requests.packages.urllib3.util.connection.HAS_IPV6 = False


SQLALCHEMY_DATABASE_URL = config("SQLALCHEMY_DATABASE_URL", default="sqlite:///db.sqlite3")


UVICORN_HOST = config("UVICORN_HOST", default="127.0.0.1")
UVICORN_PORT = config("UVICORN_PORT", cast=int, default=8000)


DEBUG = config("DEBUG", default=False, cast=bool)


XRAY_JSON = config("XRAY_JSON", default="./xray.json")
XRAY_EXECUTABLE_PATH = config("XRAY_EXECUTABLE_PATH", default="/usr/local/bin/xray")
XRAY_ASSETS_PATH = config("XRAY_ASSETS_PATH", default="/usr/local/share/xray")
XRAY_HOSTS = [
    {
        "remark": h.rsplit('@', 1)[0],
        "hostname": h.rsplit('@', 1)[1]
    }
    for h in filter(bool, config(
        "XRAY_HOSTS",
        default=f'Marz@{requests.get("https://ifconfig.io/ip").text}'
    ).split("\n"))
]


JWT_ACCESS_TOKEN_EXPIRE_MINUTES = config("JWT_ACCESS_TOKEN_EXPIRE_MINUTES", cast=int, default=1440)


# USERNAME: PASSWORD
ADMINS = {
    config("ADMIN_USERNAME", default="admin"): config("ADMIN_PASSWORD", default="admin")
}

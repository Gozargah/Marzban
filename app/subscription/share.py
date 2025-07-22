import base64
import random
import secrets
from collections import defaultdict
from datetime import datetime as dt, timedelta, timezone

from jdatetime import date as jd

from app.core.hosts import hosts as hosts_storage
from app.core.manager import core_manager
from app.db.models import UserStatus
from app.models.user import UsersResponseWithInbounds
from app.settings import subscription_settings
from app.utils.system import get_public_ip, get_public_ipv6, readable_size

from . import (
    ClashConfiguration,
    ClashMetaConfiguration,
    OutlineConfiguration,
    SingBoxConfiguration,
    StandardLinks,
    XrayConfiguration,
)

SERVER_IP = get_public_ip()
SERVER_IPV6 = get_public_ipv6()

STATUS_EMOJIS = {
    "active": "✅",
    "expired": "⌛️",
    "limited": "🪫",
    "disabled": "❌",
    "on_hold": "🔌",
}


async def generate_subscription(
    user: UsersResponseWithInbounds, config_format: str, as_base64: bool, reverse: bool = False
) -> str:
    conf = None
    if config_format == "links":
        conf = StandardLinks()
    elif config_format == "clash-meta":
        conf = ClashMetaConfiguration()
    elif config_format == "clash":
        conf = ClashConfiguration()
    elif config_format == "sing-box":
        conf = SingBoxConfiguration()
    elif config_format == "outline":
        conf = OutlineConfiguration()
    elif config_format == "xray":
        conf = XrayConfiguration()
    else:
        raise ValueError(f'Unsupported format "{config_format}"')

    format_variables = setup_format_variables(user)

    config = await process_inbounds_and_tags(user, format_variables, conf, reverse)

    if as_base64:
        config = base64.b64encode(config.encode()).decode()

    return config


def format_time_left(seconds_left: int) -> str:
    if not seconds_left or seconds_left <= 0:
        return "∞"

    minutes, seconds = divmod(seconds_left, 60)
    hours, minutes = divmod(minutes, 60)
    days, hours = divmod(hours, 24)
    months, days = divmod(days, 30)

    result = []
    if months:
        result.append(f"{months}m")
    if days:
        result.append(f"{days}d")
    if hours and (days < 7):
        result.append(f"{hours}h")
    if minutes and not (months or days):
        result.append(f"{minutes}m")
    if seconds and not (months or days):
        result.append(f"{seconds}s")
    return " ".join(result)


def setup_format_variables(user: UsersResponseWithInbounds) -> dict:
    user_status = user.status
    expire = user.expire
    on_hold_expire_duration = user.on_hold_expire_duration
    now = dt.now(timezone.utc)

    admin_username = ""
    if admin_data := user.admin:
        admin_username = admin_data.username

    if user_status != UserStatus.on_hold:
        if expire is not None:
            seconds_left = (expire - now).total_seconds()
            expire_date = expire.date()
            jalali_expire_date = jd.fromgregorian(
                year=expire_date.year, month=expire_date.month, day=expire_date.day
            ).strftime("%Y-%m-%d")
            if now < expire:
                days_left = (expire - now).days + 1
                time_left = format_time_left(seconds_left)
            else:
                days_left = "0"
                time_left = "0"

        else:
            days_left = "∞"
            time_left = "∞"
            expire_date = "∞"
            jalali_expire_date = "∞"
    else:
        if on_hold_expire_duration:
            days_left = timedelta(seconds=on_hold_expire_duration).days
            time_left = format_time_left(on_hold_expire_duration)
            expire_date = "-"
            jalali_expire_date = "-"
        else:
            days_left = "∞"
            time_left = "∞"
            expire_date = "∞"
            jalali_expire_date = "∞"

    if user.data_limit:
        data_limit = readable_size(user.data_limit)
        data_left = user.data_limit - user.used_traffic
        usage_Percentage = round((user.used_traffic / user.data_limit) * 100.0, 2)

        if data_left < 0:
            data_left = 0
        data_left = readable_size(data_left)
    else:
        data_limit = "∞"
        data_left = "∞"
        usage_Percentage = "∞"

    status_emoji = STATUS_EMOJIS.get(user.status.value)

    format_variables = defaultdict(
        lambda: "<missing>",
        {
            "SERVER_IP": SERVER_IP,
            "SERVER_IPV6": SERVER_IPV6,
            "USERNAME": user.username,
            "DATA_USAGE": readable_size(user.used_traffic),
            "DATA_LIMIT": data_limit,
            "DATA_LEFT": data_left,
            "DAYS_LEFT": days_left,
            "EXPIRE_DATE": expire_date,
            "JALALI_EXPIRE_DATE": jalali_expire_date,
            "TIME_LEFT": time_left,
            "STATUS_EMOJI": status_emoji,
            "USAGE_PERCENTAGE": usage_Percentage,
            "ADMIN_USERNAME": admin_username,
        },
    )

    return format_variables


async def filter_hosts(hosts: list, user_status: UserStatus) -> list:
    if not (await subscription_settings()).host_status_filter:
        return hosts

    return [host for host in hosts if not host["status"] or user_status in host["status"]]


async def process_host(
    host: dict, format_variables: dict, inbounds: list[str], proxies: dict, conf
) -> tuple[dict, dict, str]:
    tag = host["inbound_tag"]
    host_inbound: dict = await core_manager.get_inbound_by_tag(tag)

    protocol = host_inbound["protocol"]

    if tag not in inbounds:
        return

    settings = proxies.get(protocol)
    if not settings:
        return

    format_variables.update({"PROTOCOL": protocol})
    format_variables.update({"TRANSPORT": host_inbound["network"]})
    sni = ""
    sni_list = host["sni"] or host_inbound["sni"]
    if sni_list:
        salt = secrets.token_hex(8)
        sni = random.choice(sni_list).replace("*", salt)

    req_host = ""
    req_host_list = host["host"] or host_inbound["host"]
    if req_host_list:
        salt = secrets.token_hex(8)
        req_host = random.choice(req_host_list).replace("*", salt)

    address = ""
    address_list = host["address"]
    if host["address"]:
        salt = secrets.token_hex(8)
        address = random.choice(address_list).replace("*", salt)

    if sids := host_inbound.get("sids"):
        host_inbound["sid"] = random.choice(sids)

    if host["path"] is not None:
        path = host["path"].format_map(format_variables)
    else:
        path = host_inbound.get("path", "").format_map(format_variables)

    if host.get("use_sni_as_host", False) and sni:
        req_host = sni

    host_inbound.update(
        {
            "port": host["port"] or host_inbound["port"],
            "sni": sni,
            "host": req_host,
            "tls": host_inbound["tls"] if host["tls"] is None else host["tls"],
            "alpn": host["alpn"] if host["alpn"] else None,
            "path": path,
            "fp": host["fingerprint"] or host_inbound.get("fp", ""),
            "ais": host["allowinsecure"] or host_inbound.get("allowinsecure", ""),
            "fragment_settings": host["fragment_settings"],
            "noise_settings": host["noise_settings"],
            "random_user_agent": host["random_user_agent"],
            "http_headers": host["http_headers"],
            "mux_settings": host["mux_settings"],
        },
    )
    if ts := host["transport_settings"]:
        for v in ts.values():
            if v:
                host_inbound.update(v)

    if host.get("downloadSettings"):
        ds_data = await process_host(host["downloadSettings"], format_variables, inbounds, proxies, conf)
        if ds_data and ds_data[0]:
            ds_data[0]["address"] = ds_data[2].format_map(format_variables)
            if isinstance(conf, StandardLinks):
                xc = XrayConfiguration()
                host_inbound["downloadSettings"] = xc.download_config(ds_data[0], True)
            else:
                host_inbound["downloadSettings"] = ds_data[0]

    return host_inbound, settings, address


async def process_inbounds_and_tags(
    user: UsersResponseWithInbounds,
    format_variables: dict,
    conf: StandardLinks
    | XrayConfiguration
    | SingBoxConfiguration
    | ClashConfiguration
    | ClashMetaConfiguration
    | OutlineConfiguration,
    reverse=False,
) -> list | str:
    proxy_settings = user.proxy_settings.dict()
    for host in await filter_hosts(hosts_storage.values(), user.status):
        host_data = await process_host(host, format_variables, user.inbounds, proxy_settings, conf)
        if not host_data:
            continue
        host_inbound, settings, address = host_data

        if host_inbound:
            conf.add(
                remark=host["remark"].format_map(format_variables),
                address=address.format_map(format_variables),
                inbound=host_inbound,
                settings=settings,
            )

    return conf.render(reverse=reverse)


def encode_title(text: str) -> str:
    return f"base64:{base64.b64encode(text.encode()).decode()}"

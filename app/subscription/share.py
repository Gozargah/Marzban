import base64
import random
import secrets
from copy import deepcopy
from datetime import datetime as dt
from datetime import timedelta
from typing import TYPE_CHECKING, List, Literal, Union

from jdatetime import date as jd

from app import xray
from app.utils.system import get_public_ip, readable_size
from config import NOTICE_INBOUND

from . import *

if TYPE_CHECKING:
    from app.models.user import UserResponse

SERVER_IP = get_public_ip()

STATUS_EMOJIS = {
    "active": "✅",
    "expired": "⌛️",
    "limited": "🪫",
    "disabled": "❌",
    "on_hold": "🔌",
}


def get_v2ray_link(remark: str, address: str, inbound: dict, settings: dict):
    if inbound["protocol"] == "vmess":
        return V2rayShareLink.vmess(
            remark=remark,
            address=address,
            port=inbound["port"],
            id=settings["id"],
            net=inbound["network"],
            tls=inbound["tls"],
            sni=inbound.get("sni", ""),
            fp=inbound.get("fp", ""),
            alpn=inbound.get("alpn", ""),
            pbk=inbound.get("pbk", ""),
            sid=inbound.get("sid", ""),
            spx=inbound.get("spx", ""),
            host=inbound["host"],
            path=inbound["path"],
            type=inbound["header_type"],
            ais=inbound.get("ais", ""),
            fs=inbound.get("fragment_setting", ""),
        )

    if inbound["protocol"] == "vless":
        return V2rayShareLink.vless(
            remark=remark,
            address=address,
            port=inbound["port"],
            id=settings["id"],
            flow=settings.get("flow", ""),
            net=inbound["network"],
            tls=inbound["tls"],
            sni=inbound.get("sni", ""),
            fp=inbound.get("fp", ""),
            alpn=inbound.get("alpn", ""),
            pbk=inbound.get("pbk", ""),
            sid=inbound.get("sid", ""),
            spx=inbound.get("spx", ""),
            host=inbound["host"],
            path=inbound["path"],
            type=inbound["header_type"],
            ais=inbound.get("ais", ""),
            fs=inbound.get("fragment_setting", ""),
        )

    if inbound["protocol"] == "trojan":
        return V2rayShareLink.trojan(
            remark=remark,
            address=address,
            port=inbound["port"],
            password=settings["password"],
            flow=settings.get("flow", ""),
            net=inbound["network"],
            tls=inbound["tls"],
            sni=inbound.get("sni", ""),
            fp=inbound.get("fp", ""),
            alpn=inbound.get("alpn", ""),
            pbk=inbound.get("pbk", ""),
            sid=inbound.get("sid", ""),
            spx=inbound.get("spx", ""),
            host=inbound["host"],
            path=inbound["path"],
            type=inbound["header_type"],
            ais=inbound.get("ais", ""),
            fs=inbound.get("fragment_setting", ""),
        )

    if inbound["protocol"] == "shadowsocks":
        return V2rayShareLink.shadowsocks(
            remark=remark,
            address=address,
            port=inbound["port"],
            password=settings["password"],
            method=settings["method"],
        )


def generate_v2ray_links(proxies: dict, inbounds: dict, extra_data: dict) -> list:
    format_variables = setup_format_variables(extra_data)
    return process_inbounds_and_tags(inbounds, proxies, format_variables, mode="v2ray")


def generate_clash_subscription(
    proxies: dict, inbounds: dict, extra_data: dict, is_meta: bool = False
) -> str:
    if is_meta is True:
        conf = ClashMetaConfiguration()
    else:
        conf = ClashConfiguration()

    format_variables = setup_format_variables(extra_data)
    return process_inbounds_and_tags(
        inbounds, proxies, format_variables, mode="clash", conf=conf
    )


def generate_singbox_subscription(
    proxies: dict, inbounds: dict, extra_data: dict
) -> str:
    conf = SingBoxConfiguration()

    format_variables = setup_format_variables(extra_data)
    return process_inbounds_and_tags(
        inbounds, proxies, format_variables, mode="sing-box", conf=conf
    )


def generate_v2ray_subscription(links: list) -> str:
    return base64.b64encode("\n".join(links).encode()).decode()


def generate_outline_subscription(
    proxies: dict, inbounds: dict, extra_data: dict
) -> str:
    conf = OutlineConfiguration()

    format_variables = setup_format_variables(extra_data)
    return process_inbounds_and_tags(
        inbounds, proxies, format_variables, mode="outline", conf=conf
    )


def generate_v2ray_json_subscription(
    proxies: dict, inbounds: dict, extra_data: dict
) -> str:
    conf = V2rayJsonConfig()

    format_variables = setup_format_variables(extra_data)
    return process_inbounds_and_tags(
        inbounds, proxies, format_variables, mode="v2ray-json", conf=conf
    )


def generate_subscription(
    user: "UserResponse",
    config_format: Literal["v2ray", "clash-meta", "clash", "sing-box", "outline", "v2ray-json"],
    as_base64: bool,
) -> str:
    kwargs = {
        **(manage_notice_inbound(user.inbounds, user.proxies, user.status)),
        "extra_data": user.__dict__,
    }

    if config_format == "v2ray":
        config = "\n".join(generate_v2ray_links(**kwargs))
    elif config_format == "clash-meta":
        config = generate_clash_subscription(**kwargs, is_meta=True)
    elif config_format == "clash":
        config = generate_clash_subscription(**kwargs)
    elif config_format == "sing-box":
        config = generate_singbox_subscription(**kwargs)
    elif config_format == "outline":
        config = generate_outline_subscription(**kwargs)
    elif config_format == "v2ray-json":
        config = generate_v2ray_json_subscription(**kwargs)
    else:
        raise ValueError(f'Unsupported format "{config_format}"')

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


def setup_format_variables(extra_data: dict) -> dict:
    from app.models.user import UserStatus

    user_status = extra_data.get("status")
    expire_timestamp = extra_data.get("expire")
    on_hold_expire_duration = extra_data.get("on_hold_expire_duration")

    if user_status != UserStatus.on_hold:
        if expire_timestamp is not None and expire_timestamp >= 0:
            seconds_left = expire_timestamp - int(dt.utcnow().timestamp())
            expire_datetime = dt.fromtimestamp(expire_timestamp)
            expire_date = expire_datetime.date()
            jalali_expire_date = jd.fromgregorian(
                year=expire_date.year, month=expire_date.month, day=expire_date.day
            ).strftime("%Y-%m-%d")
            days_left = (expire_datetime - dt.utcnow()).days + 1
            time_left = format_time_left(seconds_left)
        else:
            days_left = "∞"
            time_left = "∞"
            expire_date = "∞"
            jalali_expire_date = "∞"
    else:
        if on_hold_expire_duration is not None and on_hold_expire_duration >= 0:
            days_left = timedelta(seconds=on_hold_expire_duration).days
            time_left = format_time_left(on_hold_expire_duration)
            expire_date = "-"
            jalali_expire_date = "-"
        else:
            days_left = "∞"
            time_left = "∞"
            expire_date = "∞"
            jalali_expire_date = "∞"

    if extra_data.get("data_limit"):
        data_limit = readable_size(extra_data["data_limit"])
        data_left = extra_data["data_limit"] - extra_data["used_traffic"]
        if data_left < 0:
            data_left = 0
        data_left = readable_size(data_left)
    else:
        data_limit = "∞"
        data_left = "∞"

    status_emoji = STATUS_EMOJIS.get(extra_data.get("status")) or ""

    format_variables = {
        "SERVER_IP": SERVER_IP,
        "USERNAME": extra_data.get("username", "{USERNAME}"),
        "DATA_USAGE": readable_size(extra_data.get("used_traffic")),
        "DATA_LIMIT": data_limit,
        "DATA_LEFT": data_left,
        "DAYS_LEFT": days_left,
        "EXPIRE_DATE": expire_date,
        "JALALI_EXPIRE_DATE": jalali_expire_date,
        "TIME_LEFT": time_left,
        "STATUS_EMOJI": status_emoji,
    }

    return format_variables


def process_inbounds_and_tags(
    inbounds: dict,
    proxies: dict,
    format_variables: dict,
    mode: str = "v2ray",
    conf=None,
) -> Union[List, str]:
    results = []

    _inbounds = []
    for protocol, tags in inbounds.items():
        for tag in tags:
            _inbounds.append((protocol, [tag]))
    index_dict = {proxy: index for index, proxy in enumerate(xray.config.inbounds_by_tag.keys())}
    inbounds = sorted(_inbounds, key=lambda x: index_dict.get(x[1][0], float('inf')))

    for protocol, tags in inbounds:
        settings = proxies.get(protocol)
        if not settings:
            continue

        format_variables.update({"PROTOCOL": protocol.name})
        for tag in tags:
            inbound = xray.config.inbounds_by_tag.get(tag)
            if not inbound:
                continue

            format_variables.update({"TRANSPORT": inbound["network"]})
            host_inbound = inbound.copy()
            for host in xray.hosts.get(tag, []):
                sni = ""
                sni_list = host["sni"] or inbound["sni"]
                if sni_list:
                    salt = secrets.token_hex(8)
                    sni = random.choice(sni_list).replace("*", salt)

                req_host = ""
                req_host_list = host["host"] or inbound["host"]
                if req_host_list:
                    salt = secrets.token_hex(8)
                    req_host = random.choice(req_host_list).replace("*", salt)
                if host['address']:
                    salt = secrets.token_hex(8)
                    address = host['address'].replace('*', salt)
                if host["path"] is not None:
                    path = host["path"].format_map(format_variables)
                else:
                    path = inbound.get("path", "").format_map(format_variables)

                host_inbound.update(
                    {
                        "port": host["port"] or inbound["port"],
                        "sni": sni,
                        "host": req_host,
                        "tls": inbound["tls"] if host["tls"] is None else host["tls"],
                        "alpn": host["alpn"] or inbound.get("alpn", ""),
                        "path": path,
                        "fp": host["fingerprint"] or inbound.get("fp", ""),
                        "ais": host["allowinsecure"]
                        or inbound.get("allowinsecure", ""),
                        "mux_enable": host["mux_enable"],
                        "fragment_setting": host["fragment_setting"]
                    }
                )

                if mode == "v2ray":
                    results.append(
                        get_v2ray_link(
                            remark=host["remark"].format_map(format_variables),
                            address=address.format_map(
                                format_variables),
                            inbound=host_inbound,
                            settings=settings.dict(no_obj=True),
                        )
                    )
                elif mode in ["clash", "sing-box", "outline", "v2ray-json"]:
                    conf.add(
                        remark=host["remark"].format_map(format_variables),
                        address=address.format_map(format_variables),
                        inbound=host_inbound,
                        settings=settings.dict(no_obj=True),
                    )

    if mode in ["clash", "sing-box", "outline", "v2ray-json"]:
        return conf.render()

    return results


def encode_title(text: str) -> str:
    return f"base64:{base64.b64encode(text.encode()).decode()}"


def manage_notice_inbound(inbounds, proxies, userStatus) -> dict:
    if not NOTICE_INBOUND:
        return {
            "proxies": proxies,
            "inbounds": inbounds,
        }
    from app.models.user import UserStatus
    ni = dict()
    p = dict()
    protocol = ""
    for k, v in inbounds.items():
        for i in v:
            if i == NOTICE_INBOUND:
                ni[k] = [i]
                p[k] = proxies[k]
                protocol = k
                break
        if protocol:
            break

    if ni and userStatus in (UserStatus.expired, UserStatus.limited, UserStatus.disabled):
        link_data = {
            "proxies": p,
            "inbounds": ni,
        }
    elif ni and userStatus in (UserStatus.active, UserStatus.on_hold):
        inbounds_copy = deepcopy(inbounds)
        if NOTICE_INBOUND in inbounds_copy.get(protocol, []):
            inbounds_copy[protocol].remove(NOTICE_INBOUND)
        link_data = {
            "proxies": proxies,
            "inbounds": inbounds_copy,
        }
    else:
        link_data = {
            "proxies": proxies,
            "inbounds": inbounds,
        }

    return link_data

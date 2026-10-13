import base64
import logging
import random
import secrets
from collections import defaultdict
from collections.abc import Callable
from datetime import datetime as dt
from datetime import timedelta
from typing import TYPE_CHECKING, Literal, cast

from jdatetime import date as jd

from app import xray
from app.subscription.address_context import AddressContext, settings_from_host
from app.subscription.bs_context import ZERO_STUB, BsContext, StubEndpoint
from app.utils.system import get_public_ip, get_public_ipv6, readable_size
from app.xray.host_addresses import host_allowed_for_bot

from . import *

if TYPE_CHECKING:
    from app.db import Session
    from app.models.user import UserResponse

from config import (
    ACTIVE_STATUS_TEXT,
    DISABLED_STATUS_TEXT,
    EXPIRED_STATUS_TEXT,
    LIMITED_STATUS_TEXT,
    ONHOLD_STATUS_TEXT,
)

logger = logging.getLogger("app.subscription.share")

SERVER_IP = get_public_ip()
SERVER_IPV6 = get_public_ipv6()

STATUS_EMOJIS = {
    "active": "✅",
    "expired": "⌛️",
    "limited": "🪫",
    "disabled": "❌",
    "on_hold": "🔌",
}

STATUS_TEXTS = {
    "active": ACTIVE_STATUS_TEXT,
    "expired": EXPIRED_STATUS_TEXT,
    "limited": LIMITED_STATUS_TEXT,
    "disabled": DISABLED_STATUS_TEXT,
    "on_hold": ONHOLD_STATUS_TEXT,
}


SubscriptionConf = (
    V2rayShareLink
    | V2rayJsonConfig
    | SingBoxConfiguration
    | ClashConfiguration
    | ClashMetaConfiguration
    | OutlineConfiguration
)

CONF_FACTORIES: dict[str, Callable[[], SubscriptionConf]] = {
    "v2ray": V2rayShareLink,
    "clash": ClashConfiguration,
    "clash-meta": ClashMetaConfiguration,
    "sing-box": SingBoxConfiguration,
    "outline": OutlineConfiguration,
}


def _render(
    render_format: str,
    *,
    proxies: dict,
    inbounds: dict,
    extra_data: dict,
    reverse: bool,
    bs: BsContext | None = None,
    stub: StubEndpoint | None = None,
    conf: SubscriptionConf | None = None,
    subset: AddressContext | None = None,
    bs_usage_suffix: Callable[[], str] | None = None,
) -> list | str:
    """Единая точка рендера: формат → класс конфига → process_inbounds_and_tags.

    conf передаётся готовым только для v2ray-json (его конструктор принимает карту
    документов клиентского конфига из app.services.xray_templates).
    """
    if conf is None:
        factory = CONF_FACTORIES.get(render_format)
        if factory is None:
            raise ValueError(f'Unsupported format "{render_format}"')
        conf = factory()
    return process_inbounds_and_tags(
        inbounds,
        proxies,
        setup_format_variables(extra_data),
        conf=conf,
        reverse=reverse,
        bs=bs,
        stub=stub,
        subset=subset,
        bs_usage_suffix=bs_usage_suffix,
    )


def generate_v2ray_links(
    proxies: dict,
    inbounds: dict,
    extra_data: dict,
    reverse: bool,
    bs: BsContext | None = None,
    stub: StubEndpoint | None = None,
    subset: AddressContext | None = None,
) -> list:
    return cast(
        list,
        _render(
            "v2ray",
            proxies=proxies,
            inbounds=inbounds,
            extra_data=extra_data,
            reverse=reverse,
            bs=bs,
            stub=stub,
            subset=subset,
        ),
    )


def generate_subscription(
    user: "UserResponse",
    config_format: str,
    as_base64: bool,
    reverse: bool,
    revoked: bool = False,
    expired: bool = False,
    device_limited: bool = False,
    device_limited_hard: bool = False,
    unsupported_client: bool = False,
    settings: dict | None = None,
    bs: BsContext | None = None,
    db: "Session | None" = None,
    subset: AddressContext | None = None,
    bs_usage_suffix: Callable[[], str] | None = None,
) -> str:
    bs = bs or BsContext.empty()
    from app.models.bot import DEFAULT_BOT_SETTINGS, apply_bot_settings_fallback
    from config import USE_CUSTOM_JSON_DEFAULT

    resolved_settings = apply_bot_settings_fallback(settings or DEFAULT_BOT_SETTINGS)

    # Тела документов клиентского конфига живут в app.services.xray_templates
    # (документы с историей, NPVPN-2024) и читаются через процессный кэш
    # get_cached_active_bodies — без запроса к БД на каждую подписку. Привязка лежит
    # прямо на хосте (host["client_config_id"]), поэтому карта нод больше не нужна.
    # db здесь — признак «настоящий запрос»: без него v2ray-json рендерится файловым
    # шаблоном, тот же фолбэк, что и раньше для пустых настроек.
    client_configs: dict[int, dict] = {}
    default_config_id: int | None = None
    if db is not None:
        from app.services.xray_templates import get_cached_active_bodies
        from app.xray.client_configs import parse_json_object

        def _safe_json(raw, name):
            try:
                return parse_json_object(raw)
            except ValueError as exc:
                logger.warning("[sub] ignoring invalid %s: %s", name, exc)
                return None

        # Процессный кэш (не db.info): /sub/ — горячий путь, обычный запрос БД на КАЖДУЮ
        # подписку недопустим (раньше шаблон/routing читались из уже загруженного
        # panel_settings, без лишнего JOIN). Инвалидируется через
        # app.services.xray_templates.invalidate при любой записи версии (Task 3).
        bodies = get_cached_active_bodies()
        client_configs = {
            config_id: parsed
            for config_id, raw in bodies.get("configs", {}).items()
            if (parsed := _safe_json(raw, f"client config {config_id}")) is not None
        }
        # Вторая ступень фолбэка (NPVPN-2024): хост без собственной привязки — так
        # миграция оставляет все не-БС-хосты — получает документ `default` целиком.
        default_config_id = bodies.get("default_id")

    render_format = config_format
    if config_format == "incy":
        render_format = "v2ray-json" if USE_CUSTOM_JSON_DEFAULT else "v2ray"
        as_base64 = render_format == "v2ray"

    incy_v2ray_mode = config_format == "incy" and render_format == "v2ray"

    # Special handling for inactive tokens: placeholder nodes for V2Ray/INCY
    if render_format in ("v2ray", "v2ray-json") and (revoked or expired or unsupported_client or device_limited_hard):
        from app.subscription.sub_stub import build_v2ray_status_stub, pick_status_stub_text_list

        text_list = pick_status_stub_text_list(
            revoked=revoked,
            expired=expired,
            device_limited_hard=device_limited_hard,
            unsupported_client=unsupported_client,
            settings=resolved_settings,
        )
        return build_v2ray_status_stub(
            text_list,
            cast(Literal["v2ray", "v2ray-json"], render_format),
            as_base64=as_base64,
            reverse=reverse,
            v2ray_stub_profile="incy" if incy_v2ray_mode else "default",
        )

    device_limit_links = []
    device_limit_text = []
    if render_format in ("v2ray", "v2ray-json") and device_limited and not device_limited_hard:
        from app.subscription.v2ray import V2rayShareLink

        device_limit_text = resolved_settings["sub_device_limit_server_text"] or []
        if render_format == "v2ray" and device_limit_text:
            if incy_v2ray_mode:
                from app.subscription.sub_stub import INCY_STUB_ADDRESS, INCY_STUB_ID, INCY_STUB_PORT

                stub_address = INCY_STUB_ADDRESS
                stub_port = INCY_STUB_PORT
                stub_id = INCY_STUB_ID
            else:
                stub_address = "0.0.0.0"
                stub_port = 0
                stub_id = "00000000-0000-0000-0000-000000000000"
            device_limit_links = [
                V2rayShareLink.vless(
                    remark=remark,
                    address=stub_address,
                    port=stub_port,
                    id=stub_id,
                    net="ws",
                    tls="none",
                    path="",
                    host="",
                )
                for remark in device_limit_text
            ]

    # БС-заглушки на месте: заблокированные БС-теги остаются в подписке, но их
    # хосты рендерятся как мёртвые заглушки. Прокидываем во все форматы.
    if incy_v2ray_mode:
        from app.subscription.sub_stub import INCY_STUB_ADDRESS, INCY_STUB_PORT

        stub = StubEndpoint(address=INCY_STUB_ADDRESS, port=INCY_STUB_PORT)
    elif render_format == "v2ray-json":
        from app.subscription.sub_stub import JSON_STUB_ADDRESS, JSON_STUB_PORT

        stub = StubEndpoint(address=JSON_STUB_ADDRESS, port=JSON_STUB_PORT)
    else:
        stub = ZERO_STUB

    if render_format == "v2ray":
        links = cast(
            list,
            _render(
                "v2ray",
                proxies=user.proxies,
                inbounds=user.inbounds,
                extra_data=user.__dict__,
                reverse=reverse,
                bs=bs,
                stub=stub,
                subset=subset,
                bs_usage_suffix=bs_usage_suffix,
            ),
        )
        if device_limit_links:
            links = [*device_limit_links, *links]
        config = "\n".join(links)
    elif render_format in ("clash-meta", "clash", "sing-box", "outline"):
        config = cast(
            str,
            _render(
                render_format,
                proxies=user.proxies,
                inbounds=user.inbounds,
                extra_data=user.__dict__,
                reverse=reverse,
                bs=bs,
                stub=stub,
                subset=subset,
                bs_usage_suffix=bs_usage_suffix,
            ),
        )
    elif render_format == "v2ray-json":
        from app.subscription.sub_stub import JSON_STUB_ADDRESS, JSON_STUB_ID, JSON_STUB_PORT
        from app.subscription.v2ray import V2rayJsonConfig

        conf = V2rayJsonConfig(configs=client_configs, default_id=default_config_id)
        if device_limit_text:
            stub_inbound = {
                "network": "ws",
                "protocol": "vless",
                "port": JSON_STUB_PORT,
                "tls": "none",
                "header_type": "",
                "fragment_setting": "",
                "noise_setting": "",
                "path": "",
                "host": "",
                "sni": "",
            }
            for remark in device_limit_text:
                conf.add(
                    remark=remark,
                    address=JSON_STUB_ADDRESS,
                    inbound=stub_inbound,
                    settings={"id": JSON_STUB_ID},
                )
        config = cast(
            str,
            _render(
                "v2ray-json",
                proxies=user.proxies,
                inbounds=user.inbounds,
                extra_data=user.__dict__,
                reverse=reverse,
                bs=bs,
                stub=stub,
                conf=conf,
                subset=subset,
                bs_usage_suffix=bs_usage_suffix,
            ),
        )
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
    now = dt.utcnow()
    now_ts = now.timestamp()

    if user_status != UserStatus.on_hold:
        if expire_timestamp is not None and expire_timestamp >= 0:
            seconds_left = expire_timestamp - int(dt.utcnow().timestamp())
            expire_datetime = dt.fromtimestamp(expire_timestamp)
            expire_date = expire_datetime.date()
            jalali_expire_date = jd.fromgregorian(
                year=expire_date.year, month=expire_date.month, day=expire_date.day
            ).strftime("%Y-%m-%d")
            if now_ts < expire_timestamp:
                days_left = (expire_datetime - dt.utcnow()).days + 1
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
    status_text = STATUS_TEXTS.get(extra_data.get("status")) or ""

    format_variables = defaultdict(
        lambda: "<missing>",
        {
            "SERVER_IP": SERVER_IP,
            "SERVER_IPV6": SERVER_IPV6,
            "USERNAME": extra_data.get("username", "{USERNAME}"),
            "DATA_USAGE": readable_size(extra_data.get("used_traffic")),
            "DATA_LIMIT": data_limit,
            "DATA_LEFT": data_left,
            "DAYS_LEFT": days_left,
            "EXPIRE_DATE": expire_date,
            "JALALI_EXPIRE_DATE": jalali_expire_date,
            "TIME_LEFT": time_left,
            "STATUS_EMOJI": status_emoji,
            "STATUS_TEXT": status_text,
            "BOT_USERNAME": extra_data.get("bot_username"),
        },
    )

    return format_variables


def process_inbounds_and_tags(
    inbounds: dict,
    proxies: dict,
    format_variables: dict,
    conf: V2rayShareLink
    | V2rayJsonConfig
    | SingBoxConfiguration
    | ClashConfiguration
    | ClashMetaConfiguration
    | OutlineConfiguration,
    reverse=False,
    bs: BsContext | None = None,
    stub: StubEndpoint | None = None,
    subset: AddressContext | None = None,
    bs_usage_suffix: Callable[[], str] | None = None,
) -> list | str:
    bs = bs or BsContext.empty()
    stub = stub or ZERO_STUB
    subset = subset or AddressContext.disabled()
    # Суффикс расхода БС считается один раз, и только когда в выдачу попал живой БС-хост.
    bs_usage_label: str | None = None

    def host_remark(host: dict) -> str:
        nonlocal bs_usage_label
        remark = host["remark"].format_map(format_variables)
        if bs_usage_suffix is None or not host.get("is_bs"):
            return remark
        if bs_usage_label is None:
            bs_usage_label = bs_usage_suffix()
        return f"{remark}{bs_usage_label}"

    _inbounds = []
    for protocol, tags in inbounds.items():
        for tag in tags:
            _inbounds.append((protocol, [tag]))
    index_dict = {proxy: index for index, proxy in enumerate(xray.config.inbounds_by_tag.keys())}
    inbounds = sorted(_inbounds, key=lambda x: index_dict.get(x[1][0], float("inf")))
    user_bot_username = format_variables.get("BOT_USERNAME")

    candidates: list[dict] = []

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
            for host in xray.hosts.get(tag, []):
                allowed_bot_usernames = host.get("bot_usernames") or []
                if not host_allowed_for_bot(allowed_bot_usernames, user_bot_username):
                    continue

                host_inbound = inbound.copy()

                sni = ""
                sni_list = host["sni"] or inbound["sni"]
                if sni_list:
                    salt = secrets.token_hex(8)
                    sni = random.choice(sni_list).replace("*", salt)

                if sids := inbound.get("sids"):
                    host_inbound["sid"] = random.choice(sids)

                req_host = ""
                req_host_list = host["host"] or inbound["host"]
                if req_host_list:
                    salt = secrets.token_hex(8)
                    req_host = random.choice(req_host_list).replace("*", salt)

                address = ""
                address_list = host["address"]
                # Сужение — ДО расчёта balanced, который зависит от длины списка.
                # Отдельного исключения для БС-хостов не требуется: заблокированный
                # БС-хост уходит в ветку bs.is_blocked() ниже, где адрес подменяется
                # на заглушку и суженный список не используется вовсе; а у
                # незаблокированного БС-хоста сужение лишь концентрирует расход на
                # меньшем числе нод — БС-лимит считается агрегатом по юзеру
                # (aggregate_bs_usage), а не по ноде, поэтому учёт не ломается.
                if address_list:
                    address_list = subset.pick(
                        address_list,
                        host.get("node_ids") or [],
                        addresses_from_nodes=bool(host.get("addresses_from_nodes")),
                        host_id=host.get("id"),
                        # NPVPN-2072: размер подмножества и период ротации — свойства ХОСТА:
                        # у локаций разное число нод, и один размер на всего бота этого не
                        # выражал.
                        settings=settings_from_host(host),
                    )
                balanced = isinstance(conf, V2rayJsonConfig) and address_list and len(address_list) > 1
                if address_list and not balanced:
                    salt = secrets.token_hex(8)
                    address = random.choice(address_list).replace("*", salt)

                if host["path"] is not None:
                    path = host["path"].format_map(format_variables)
                else:
                    path = inbound.get("path", "").format_map(format_variables)

                if host.get("use_sni_as_host", False) and sni:
                    req_host = sni

                host_inbound.update(
                    {
                        "port": host["port"] or inbound["port"],
                        "sni": sni,
                        "host": req_host,
                        "tls": inbound["tls"] if host["tls"] is None else host["tls"],
                        "alpn": host["alpn"] if host["alpn"] else None,
                        "path": path,
                        "fp": host["fingerprint"] or inbound.get("fp", ""),
                        "ais": host["allowinsecure"] or inbound.get("allowinsecure", ""),
                        "mux_enable": host["mux_enable"],
                        "fragment_setting": host["fragment_setting"],
                        "noise_setting": host["noise_setting"],
                        "random_user_agent": host["random_user_agent"],
                        "xhttp_extra": host["xhttp_extra"] or inbound.get("xhttp_extra"),
                    }
                )

                # БС-лимит исчерпан → хост заблокированной БС-ноды (матч по связям
                # host→nodes) остаётся на своём месте, но превращается в мёртвую
                # заглушку с именем-текстом лимита. Хосты обычных нод не трогаем.
                if bs.is_blocked(host):
                    host_inbound["port"] = stub.port
                    candidates.append(
                        {
                            "order": host.get("order", 0),
                            "blocked": True,
                            "host_inbound": host_inbound,
                            "settings": settings.model_dump(),
                        }
                    )
                    continue

                # Пер-серверный конфиг только для v2ray-json: привязка лежит на самом
                # хосте. Другие форматы про документы конфига не знают.
                add_kwargs = {}
                if isinstance(conf, V2rayJsonConfig):
                    config_id = host.get("client_config_id")
                    if config_id is not None:
                        add_kwargs["client_config_id"] = config_id

                candidate = {
                    "order": host.get("order", 0),
                    "blocked": False,
                    "host_inbound": host_inbound,
                    "settings": settings.model_dump(),
                    "add_kwargs": add_kwargs,
                    "remark": host_remark(host),
                    "balanced": balanced and isinstance(conf, V2rayJsonConfig),
                }
                if candidate["balanced"]:
                    candidate["addresses"] = [
                        addr.replace("*", secrets.token_hex(8)).format_map(format_variables) for addr in address_list
                    ]
                else:
                    candidate["address"] = address.format_map(format_variables)
                candidates.append(candidate)

    def _candidate_order(item: dict) -> int:
        order = item.get("order")
        return int(order) if order is not None else 0

    candidates.sort(key=_candidate_order)

    for item in candidates:
        if item["blocked"]:
            conf.add(
                remark=bs.stub_text,
                address=stub.address,
                inbound=item["host_inbound"],
                settings=item["settings"],
            )
            continue

        if item["balanced"] and isinstance(conf, V2rayJsonConfig):
            conf.add_balanced(
                remark=item["remark"],
                addresses=item["addresses"],
                inbound=item["host_inbound"],
                settings=item["settings"],
                **item["add_kwargs"],
            )
        else:
            conf.add(
                remark=item["remark"],
                address=item["address"],
                inbound=item["host_inbound"],
                settings=item["settings"],
                **item["add_kwargs"],
            )

    return conf.render(reverse=reverse)

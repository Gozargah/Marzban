"""IP клиента из запроса и выбор IP для устройства подписки (NPVPN-2148)."""

import ipaddress
from collections.abc import Collection

from fastapi import Request

UNKNOWN_CLIENT_IP = "Unknown"


def get_client_ip(request: Request) -> str:
    """IP клиента: первый адрес X-Forwarded-For, иначе peer-адрес.

    nginx ставит X-Forwarded-For перезаписью ($real_client_ip), а не дописыванием,
    поэтому первый адрес — реальный клиент, а не подставленный им заголовок.
    """
    forwarded_for = request.headers.get("X-Forwarded-For")
    if forwarded_for:
        return forwarded_for.split(",")[0].strip()
    if request.client:
        return request.client.host
    return UNKNOWN_CLIENT_IP


def _normalized_ip(value: str) -> str | None:
    try:
        return str(ipaddress.ip_address(value))
    except ValueError:
        return None


def device_ip(raw_ip: str | None, node_addresses: Collection[str]) -> str | None:
    """IP, который стоит записать устройству, или None — оставить прежний.

    Пишем только публичный (global) IP в нормализованном виде. Строка из заголовка
    может быть любым токеном: не-IP не должен попасть в БД (длинная строка валит
    commit на MySQL strict, мусор показывается оператору как IP). Приватные,
    loopback и docker-адреса (hairpin через nginx) оператору поддержки бесполезны
    и не должны затирать настоящий IP.

    С включённым VPN многие клиенты обновляют подписку через туннель, и к /sub
    приходит IP выхода нашей ноды: об операторе пользователя он ничего не говорит
    и тоже не затирает настоящий IP. Адреса нод сравниваются в нормализованном виде,
    не-IP в node_addresses пропускаются.
    """
    if not raw_ip:
        return None
    try:
        ip = ipaddress.ip_address(raw_ip)
    except ValueError:
        return None
    if not ip.is_global:
        return None
    normalized = str(ip)
    if normalized in {n for n in map(_normalized_ip, node_addresses) if n}:
        return None
    return normalized

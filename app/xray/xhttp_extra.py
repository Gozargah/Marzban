"""Клиентский `extra` xhttp-транспорта, заданный в самом инбаунде."""

from __future__ import annotations

from copy import deepcopy

# Параметры xhttpSettings инбаунда, которые клиент обязан повторить у себя.
# path/host/mode сюда не входят: в ссылке и в JSON-конфиге это отдельные поля.
XHTTP_CLIENT_EXTRA_KEYS = (
    "scMaxEachPostBytes",
    "scMaxConcurrentPosts",
    "scMinPostsIntervalMs",
    "xPaddingBytes",
    "xmux",
    "noGRPCHeader",
    "keepAlivePeriod",
)


def inbound_xhttp_extra(net_settings: dict) -> dict:
    """Только явно заданные в инбаунде параметры, без дефолтов панели.

    Незаданный параметр клиент берёт из дефолтов своего xray-ядра — панель не
    должна навязывать ему собственные значения (NPVPN-2169).
    """
    return {key: deepcopy(net_settings[key]) for key in XHTTP_CLIENT_EXTRA_KEYS if key in net_settings}

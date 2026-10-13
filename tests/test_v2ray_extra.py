"""xhttp/splithttp: extra сериализуется компактно, без пробелов.

Регрессия NPVPN-1583: пробелы в JSON extra кодировались urlencode как "+",
клиенты (Happ на iOS) не декодировали "+" обратно в пробел и ломали extra.

NPVPN-2169: панель не дописывает в extra параметры из своего кода — в ссылку и
в JSON-конфиг попадает только то, что задано хостом или инбаундом.
"""

from __future__ import annotations

import base64  # noqa: E402
import json
import sys
import types
from urllib.parse import parse_qs

import pytest

# v2ray.py на импорте тянет тяжёлые модули (шаблоны, config, xray),
# которые не нужны для проверки сериализации xhttp-ссылок. Заглушаем их.
# Значения — заглушки-константы: в тестируемом пути (xhttp) они не вызываются.
for _name, _attrs in {
    "app.subscription.funcs": {"get_grpc_gun": None, "get_grpc_multi": None},
    "app.templates": {"render_template": None},
    "app.utils.helpers": {"UUIDEncoder": json.JSONEncoder},
    "app.xray.client_configs": {
        "select_config": None,
        "parse_json_object": None,
    },
}.items():
    if _name not in sys.modules:
        _mod = types.ModuleType(_name)
        for _k, _v in _attrs.items():
            setattr(_mod, _k, _v)
        sys.modules[_name] = _mod

if "config" not in sys.modules:
    _config = types.ModuleType("config")
    for _const in (
        "EXTERNAL_CONFIG",
        "GRPC_USER_AGENT_TEMPLATE",
        "MUX_TEMPLATE",
        "USER_AGENT_TEMPLATE",
        "V2RAY_SETTINGS_TEMPLATE",
        "V2RAY_SUBSCRIPTION_TEMPLATE",
    ):
        setattr(_config, _const, "")
    sys.modules["config"] = _config

from app.subscription.v2ray import V2rayShareLink  # noqa: E402


def _extra_from_link(link: str) -> str:
    raw_query = link.split("?", 1)[1].split("#", 1)[0]
    return parse_qs(raw_query)["extra"][0]


# Вложенный объект: именно на нём json.dumps по умолчанию ставит пробелы.
_NESTED_EXTRA = {"xmux": {"maxConcurrency": 16, "hKeepAlivePeriod": 8}, "noGRPCHeader": True}


def test_vless_xhttp_extra_is_compact():
    link = V2rayShareLink.vless(
        remark="test",
        address="example.com",
        port=443,
        id="00000000-0000-0000-0000-000000000000",
        net="xhttp",
        tls="tls",
        xhttp_extra=_NESTED_EXTRA,
    )
    raw_query = link.split("?", 1)[1].split("#", 1)[0]
    # После urlencode компактного JSON не должно быть "+" (закодированного пробела)
    assert "+" not in raw_query

    extra = _extra_from_link(link)
    assert " " not in extra
    # extra остаётся валидным JSON
    json.loads(extra)


def test_trojan_xhttp_extra_is_compact():
    link = V2rayShareLink.trojan(
        remark="test",
        address="example.com",
        port=443,
        password="secret",
        net="xhttp",
        tls="tls",
        xhttp_extra=_NESTED_EXTRA,
    )
    raw_query = link.split("?", 1)[1].split("#", 1)[0]
    assert "+" not in raw_query

    extra = _extra_from_link(link)
    assert " " not in extra
    json.loads(extra)


def _vmess_payload(link: str) -> dict:
    raw = link[len("vmess://") :]
    return json.loads(base64.b64decode(raw).decode())


def test_vless_xhttp_extra_full_replace():
    custom = {"xPaddingMethod": "tokenish", "seqKey": "chunk_id"}
    link = V2rayShareLink.vless(
        remark="t",
        address="e.com",
        port=443,
        id="00000000-0000-0000-0000-000000000000",
        net="xhttp",
        tls="tls",
        xhttp_extra=custom,
    )
    extra = json.loads(_extra_from_link(link))
    assert extra == custom  # только заданные ключи, без дефолтных 5


def test_trojan_xhttp_extra_full_replace():
    custom = {"xPaddingMethod": "tokenish"}
    link = V2rayShareLink.trojan(
        remark="t",
        address="e.com",
        port=443,
        password="p",
        net="xhttp",
        tls="tls",
        xhttp_extra=custom,
    )
    assert json.loads(_extra_from_link(link)) == custom


def test_vmess_xhttp_extra_full_replace():
    custom = {"xPaddingMethod": "tokenish", "noGRPCHeader": True}
    link = V2rayShareLink.vmess(
        remark="t",
        address="e.com",
        port=443,
        id="00000000-0000-0000-0000-000000000000",
        net="xhttp",
        tls="tls",
        xhttp_extra=custom,
    )
    assert _vmess_payload(link)["extra"] == custom


def _query(link: str) -> dict:
    return parse_qs(link.split("?", 1)[1].split("#", 1)[0])


@pytest.mark.parametrize("empty", [None, {}])
def test_vless_xhttp_without_extra_adds_nothing(empty):
    link = V2rayShareLink.vless(
        remark="t",
        address="e.com",
        port=443,
        id="00000000-0000-0000-0000-000000000000",
        net="xhttp",
        tls="tls",
        path="/p",
        xhttp_extra=empty,
    )
    query = _query(link)
    assert "extra" not in query
    # транспортные поля самой ссылки на месте
    assert query["path"] == ["/p"]
    assert query["mode"] == ["auto"]


@pytest.mark.parametrize("empty", [None, {}])
def test_trojan_xhttp_without_extra_adds_nothing(empty):
    link = V2rayShareLink.trojan(
        remark="t",
        address="e.com",
        port=443,
        password="p",
        net="xhttp",
        tls="tls",
        xhttp_extra=empty,
    )
    assert "extra" not in _query(link)


@pytest.mark.parametrize("empty", [None, {}])
def test_vmess_xhttp_without_extra_adds_nothing(empty):
    link = V2rayShareLink.vmess(
        remark="t",
        address="e.com",
        port=443,
        id="00000000-0000-0000-0000-000000000000",
        net="xhttp",
        tls="tls",
        xhttp_extra=empty,
    )
    payload = _vmess_payload(link)
    assert "extra" not in payload
    assert payload["type"] == "auto"


from app.subscription.v2ray import V2rayJsonConfig  # noqa: E402


def _splithttp(template: dict | None = None, **kwargs):
    # Обходим тяжёлый __init__: собираем ровно то, что нужно splithttp_config.
    cfg = V2rayJsonConfig.__new__(V2rayJsonConfig)
    cfg.settings = {"splithttpSettings": template} if template is not None else {}
    cfg.user_agent_list = []
    return cfg.splithttp_config(**kwargs)


def test_splithttp_without_extra_adds_nothing():
    cfg = _splithttp(path="/p", host="h.com")
    assert cfg == {"mode": "auto", "path": "/p", "host": "h.com"}


def test_splithttp_keeps_template_extra_untouched():
    # extra из шаблона V2RAY_SETTINGS_TEMPLATE задан оператором — отдаём как есть.
    template = {"extra": {"xPaddingBytes": "1-2"}}
    cfg = _splithttp(template=template, path="/p", host="h.com")
    assert cfg["extra"] == {"xPaddingBytes": "1-2"}


def test_splithttp_xhttp_extra_full_replace():
    custom = {"xPaddingMethod": "tokenish", "seqKey": "chunk_id"}
    cfg = _splithttp(template={"extra": {"xPaddingBytes": "1-2"}}, path="/p", host="h.com", xhttp_extra=custom)
    assert cfg["extra"] == custom

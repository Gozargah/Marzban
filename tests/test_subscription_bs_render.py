"""Рендер БС-хостов подписки (NPVPN-1652): заглушка лимита и is_bs-routing.

Слой генерации (app/subscription/share.py::process_inbounds_and_tags) тянет тяжёлые
модули (app.templates → app.scheduler, app.utils.system → app.scheduler), которые в
песочнице tests/conftest.py недоступны. Заглушаем ровно их (шаблоны рендерим настоящим
jinja2 из app/templates), остальное — настоящие V2rayJsonConfig / share / bs_context.
"""

from __future__ import annotations

import base64
import copy
import importlib.util
import json
import pathlib
import sys
import types
import urllib.parse
from collections import defaultdict

import jinja2
import pytest

import config as panel_config

_ROOT = pathlib.Path(__file__).parent.parent


def _stub_module(name: str, attrs: dict) -> types.ModuleType:
    """Дописать недостающие атрибуты в заглушку модуля (её мог завести другой тест)."""
    module = sys.modules.get(name) or types.ModuleType(name)
    for key, value in attrs.items():
        if getattr(module, key, None) is None:
            setattr(module, key, value)
    sys.modules[name] = module
    return module


# app.utils.system: тянет app.scheduler; в тестируемом пути нужны только эти функции.
_stub_module(
    "app.utils.system",
    {
        "get_public_ip": lambda: "127.0.0.1",
        "get_public_ipv6": lambda: "::1",
        "readable_size": lambda size: str(size),
    },
)


def _load_real_module(name: str, path: pathlib.Path) -> types.ModuleType:
    """Импортировать конкретный файл модуля напрямую, минуя app/templates/__init__.py
    (тот тянет app.utils.system → app.scheduler и не нужен: сами фильтры от него
    зависят только через readable_size, который уже застаблен выше)."""
    spec = importlib.util.spec_from_file_location(name, path)
    module = importlib.util.module_from_spec(spec)
    sys.modules[name] = module
    spec.loader.exec_module(module)
    return module


# app.templates: настоящий пакет (через __init__.py) тянет app.utils.system → app.scheduler
# (весь FastAPI). Подменяем лёгким jinja-рендером тех же файлов app/templates/*, но с
# НАСТОЯЩИМИ кастомными фильтрами (yaml/except/only/...) из app/templates/filters.py —
# без них clash/singbox шаблоны не рендерятся (используют `| yaml`, `| except(...)`).
_templates_filters = _load_real_module("app.templates.filters", _ROOT / "app" / "templates" / "filters.py")
_env = jinja2.Environment(loader=jinja2.FileSystemLoader(str(_ROOT / "app" / "templates")))
_env.filters.update(_templates_filters.CUSTOM_FILTERS)
_stub_module(
    "app.templates",
    {"render_template": lambda template, context=None: _env.get_template(template).render(context or {})},
)

from app.subscription.bs_context import ZERO_STUB, BsContext, StubEndpoint  # noqa: E402
from app.subscription.clash import ClashConfiguration, ClashMetaConfiguration  # noqa: E402
from app.subscription.outline import OutlineConfiguration  # noqa: E402
from app.subscription.singbox import SingBoxConfiguration  # noqa: E402
from app.subscription.sub_stub import (  # noqa: E402
    INCY_STUB_ADDRESS,
    INCY_STUB_PORT,
    JSON_STUB_ADDRESS,
    JSON_STUB_PORT,
)
from app.subscription.v2ray import V2rayJsonConfig, V2rayShareLink  # noqa: E402

# share.py делает `from . import *`; в песочнице app/subscription/__init__.py не выполняется
# (conftest подменяет пакет), поэтому кладём классы конфигов в модуль пакета руками.
_subscription_pkg = sys.modules["app.subscription"]
for _name, _cls in {
    "ClashConfiguration": ClashConfiguration,
    "ClashMetaConfiguration": ClashMetaConfiguration,
    "OutlineConfiguration": OutlineConfiguration,
    "SingBoxConfiguration": SingBoxConfiguration,
    "V2rayJsonConfig": V2rayJsonConfig,
    "V2rayShareLink": V2rayShareLink,
}.items():
    setattr(_subscription_pkg, _name, _cls)

from app.subscription import share  # noqa: E402

BS_TAG = "VLESS_TCP"
BS_NODE_ID = 7
STUB_TEXT = "Лимит БС исчерпан"


class _Protocol:
    """Мини-замена ProxyTypes: process_inbounds_and_tags использует только .name."""

    name = "vless"


class _ProxySettings:
    def model_dump(self):
        return {"id": "00000000-0000-0000-0000-000000000000", "flow": ""}


class _FakeConf:
    """Не-V2rayJsonConfig конфиг: пишем в лог все add-вызовы."""

    def __init__(self):
        self.calls: list[dict] = []

    def add(self, remark, address, inbound, settings, **kwargs):
        self.calls.append({"remark": remark, "address": address, "inbound": inbound, "kwargs": kwargs})

    def render(self, reverse=False):
        return "rendered"


def _inbound() -> dict:
    return {
        "tag": BS_TAG,
        "network": "tcp",
        "protocol": "vless",
        "port": 443,
        "tls": "reality",
        "header_type": "",
        "fragment_setting": "",
        "noise_setting": "",
        "path": "",
        "sni": ["example.com"],
        "host": [],
        "fp": "chrome",
        "pbk": "pbk",
        "sid": "0123",
        "spx": "",
        "alpn": None,
        "ais": "",
    }


def _host(
    *addresses: str,
    node_ids: list[int] | None = None,
    remark: str = "BS server",
    order: int = 0,
    client_config_id: int | None = None,
    addresses_from_nodes: bool = True,
    subset_size: int | None = None,
    rotation_days: int = 1,
    is_bs: bool = False,
) -> dict:
    """Хост подписки: адрес — ДОМЕН (маскировка), нода привязана по node_ids.

    client_config_id — документ клиентского конфига этого хоста (NPVPN-2024);
    None означает фолбэк на документ `default`.

    `addresses_from_nodes=True` по умолчанию: адреса в этих тестах строятся по
    тому же множеству нод, что и node_ids (как resolve_host_addresses делает при
    пустом host.address) — см. NPVPN-2072, AddressContext.pick.
    """
    return {
        "remark": remark,
        "address": list(addresses),
        "node_ids": list(node_ids or []),
        "client_config_id": client_config_id,
        "addresses_from_nodes": addresses_from_nodes,
        # NPVPN-2072: сужение настраивается на хосте — size=None означает «отдавать все».
        "address_subset_enabled": subset_size is not None,
        "address_subset_size": subset_size,
        "address_rotation_days": rotation_days,
        "port": 8443,
        "sni": [],
        "host": [],
        "path": None,
        "tls": None,
        "alpn": "",
        "fingerprint": "",
        "allowinsecure": False,
        "mux_enable": False,
        "fragment_setting": "",
        "noise_setting": "",
        "random_user_agent": False,
        "xhttp_extra": None,
        "use_sni_as_host": False,
        # NPVPN-2044: хост виден только привязанному боту, поэтому фикстура
        # привязывает его к тому же боту, что подставлен в BOT_USERNAME ниже.
        "bot_usernames": ["probe-bot"],
        "order": order,
        "is_bs": is_bs,
    }


@pytest.fixture
def xray_stub(monkeypatch):
    """xray.config.inbounds_by_tag / xray.hosts — единственное, что share берёт из xray."""

    def _apply(hosts: list[dict], inbound: dict | None = None):
        inbound = inbound or _inbound()
        monkeypatch.setattr(
            share.xray,
            "config",
            types.SimpleNamespace(inbounds_by_tag={BS_TAG: inbound}),
            raising=False,
        )
        monkeypatch.setattr(share.xray, "hosts", {BS_TAG: hosts}, raising=False)

    return _apply


def _render(conf, bs: BsContext, stub: StubEndpoint = ZERO_STUB, subset=None, bs_usage_suffix=None):
    # setup_format_variables тянет app.models.user → app.db; подставляем готовые переменные.
    # NPVPN-2044: BOT_USERNAME обязателен — хост виден только привязанному боту,
    # и с None предикат не отдаст ни одной локации.
    format_variables = defaultdict(lambda: "<missing>", {"USERNAME": "u1", "BOT_USERNAME": "probe-bot"})
    protocol = _Protocol()
    return share.process_inbounds_and_tags(
        inbounds={protocol: [BS_TAG]},
        proxies={protocol: _ProxySettings()},
        format_variables=format_variables,
        conf=conf,
        bs=bs,
        stub=stub,
        subset=subset,
        bs_usage_suffix=bs_usage_suffix,
    )


def _xhttp_inbound(extra: dict) -> dict:
    return {**_inbound(), "network": "xhttp", "xhttp_extra": extra}


def test_host_xhttp_extra_overrides_inbound_extra(xray_stub):
    host = _host("x.example.com", node_ids=[42])
    host["xhttp_extra"] = {"xPaddingMethod": "tokenish"}
    xray_stub([host], inbound=_xhttp_inbound({"scMaxConcurrentPosts": 10}))
    conf = _FakeConf()

    _render(conf, BsContext.empty())

    assert conf.calls[0]["inbound"]["xhttp_extra"] == {"xPaddingMethod": "tokenish"}


def test_host_without_xhttp_extra_falls_back_to_inbound_extra(xray_stub):
    """NPVPN-2169: без extra на хосте клиент получает только заданное в инбаунде."""
    xray_stub([_host("x.example.com", node_ids=[42])], inbound=_xhttp_inbound({"scMaxConcurrentPosts": 10}))
    conf = _FakeConf()

    _render(conf, BsContext.empty())

    assert conf.calls[0]["inbound"]["xhttp_extra"] == {"scMaxConcurrentPosts": 10}


def _blocked_ctx() -> BsContext:
    return BsContext(
        blocked_node_ids=frozenset({BS_NODE_ID}),
        stub_text=STUB_TEXT,
    )


def test_blocked_domain_host_renders_stub_with_text_address_and_port(xray_stub):
    """Ключевой кейс тикета: БС-хост задан ДОМЕНОМ, нода — по IP; хост заблокирован."""
    xray_stub([_host("bs.example.com", node_ids=[BS_NODE_ID])])
    conf = _FakeConf()
    stub = StubEndpoint(address="127.0.0.1", port=1)

    _render(conf, _blocked_ctx(), stub=stub)

    assert len(conf.calls) == 1
    call = conf.calls[0]
    assert call["remark"] == STUB_TEXT  # имя сервера-заглушки НЕ пустое
    assert call["address"] == stub.address
    assert call["inbound"]["port"] == stub.port
    assert call["kwargs"] == {}  # заглушка не получает is_bs


def test_non_bs_host_is_not_stubbed(xray_stub):
    xray_stub([_host("plain.example.com", node_ids=[42])])
    conf = _FakeConf()

    _render(conf, _blocked_ctx())

    assert conf.calls[0]["remark"] == "BS server"
    assert conf.calls[0]["address"] == "plain.example.com"


def test_bs_host_remark_appends_usage_suffix_once(xray_stub):
    calls = []

    def loader():
        calls.append(1)
        return " - (1,2/3 ГБ)"

    xray_stub(
        [
            _host("plain.example.com", remark="Обычный", node_ids=[42]),
            _host("bs.example.com", remark="Нидерланды БС", node_ids=[BS_NODE_ID], is_bs=True),
            _host("bs2.example.com", remark="Финляндия БС", node_ids=[BS_NODE_ID], is_bs=True, order=1),
        ]
    )
    conf = _FakeConf()

    _render(conf, BsContext.empty(), bs_usage_suffix=loader)

    assert [call["remark"] for call in conf.calls] == [
        "Обычный",
        "Нидерланды БС - (1,2/3 ГБ)",
        "Финляндия БС - (1,2/3 ГБ)",
    ]
    assert calls == [1]


def test_bs_usage_loader_skipped_without_bs_hosts(xray_stub):
    calls = []
    xray_stub([_host("plain.example.com", remark="Обычный", node_ids=[42])])
    conf = _FakeConf()

    _render(conf, BsContext.empty(), bs_usage_suffix=lambda: calls.append(1) or " - (0/3 ГБ)")

    assert conf.calls[0]["remark"] == "Обычный"
    assert calls == []


def test_bs_host_remark_unchanged_without_usage_loader(xray_stub):
    xray_stub([_host("bs.example.com", remark="Нидерланды БС", is_bs=True)])
    conf = _FakeConf()

    _render(conf, BsContext.empty())

    assert conf.calls[0]["remark"] == "Нидерланды БС"


def test_blocked_bs_host_keeps_stub_and_does_not_load_usage(xray_stub):
    calls = []
    xray_stub([_host("bs.example.com", node_ids=[BS_NODE_ID], is_bs=True, remark="Нидерланды БС")])
    conf = _FakeConf()

    _render(conf, _blocked_ctx(), bs_usage_suffix=lambda: calls.append(1) or " - (3/3 ГБ)")

    assert conf.calls[0]["remark"] == STUB_TEXT
    assert calls == []


def test_hosts_emitted_sorted_by_global_order(monkeypatch):
    """Кандидаты из разных инбаундов сортируются по order, а не по порядку тегов."""
    tag_a, tag_b = "VLESS_A", "TROJAN_B"
    inbound_a = {**_inbound(), "tag": tag_a, "protocol": "vless"}
    inbound_b = {**_inbound(), "tag": tag_b, "protocol": "trojan", "network": "tcp"}
    monkeypatch.setattr(
        share.xray,
        "config",
        types.SimpleNamespace(inbounds_by_tag={tag_a: inbound_a, tag_b: inbound_b}),
        raising=False,
    )
    monkeypatch.setattr(
        share.xray,
        "hosts",
        {
            tag_a: [
                _host("a1.example.com", remark="A1", order=2),
                _host("a2.example.com", remark="A2", order=0),
            ],
            tag_b: [_host("b1.example.com", remark="B1", order=1)],
        },
        raising=False,
    )

    class _Vless:
        name = "vless"

    class _Trojan:
        name = "trojan"

    protocol_vless = _Vless()
    protocol_trojan = _Trojan()
    conf = _FakeConf()
    format_variables = defaultdict(lambda: "<missing>", {"USERNAME": "u1", "BOT_USERNAME": "probe-bot"})
    share.process_inbounds_and_tags(
        inbounds={protocol_vless: [tag_a], protocol_trojan: [tag_b]},
        proxies={protocol_vless: _ProxySettings(), protocol_trojan: _ProxySettings()},
        format_variables=format_variables,
        conf=conf,
        bs=BsContext.empty(),
    )

    assert [call["remark"] for call in conf.calls] == ["A2", "B1", "A1"]


# Документы клиентского конфига для v2ray-json-тестов: id, назначаемые хостам через
# client_config_id — поле, которое раньше заменял булев is_bs.
DEFAULT_CONFIG_ID = 1
BS_CONFIG_ID = 2
# Документ, который СУЩЕСТВУЕТ и может быть назначен хосту, но его тело пусто —
# поэтому его нет в карте тел configs.
EMPTY_CONFIG_ID = 3
OTHER_NODE_ID = 42

DEFAULT_ROUTING = {"rules": [{"type": "field", "outboundTag": "direct", "domain": ["default"]}]}
BS_ROUTING = {"rules": [{"type": "field", "outboundTag": "direct", "domain": ["bs"]}]}
TEMPLATE_ROUTING = {"rules": [{"type": "field", "ip": ["geoip:ru"], "outboundTag": "direct"}]}

# Файловый шаблон — последняя ступень фолбэка. В тестах подставляем предсказуемый
# конфиг вместо app/templates/v2ray/default.json (раньше ту же роль играл параметр
# template_override, которого у самодостаточных документов уже нет).
FILE_TEMPLATE = {
    "remarks": "",
    "outbounds": [
        {"protocol": "freedom", "tag": "direct"},
        {"protocol": "blackhole", "tag": "block"},
    ],
    "routing": TEMPLATE_ROUTING,
}


def _config_document(routing: dict) -> dict:
    """Самодостаточный документ: полный конфиг целиком, а не одна секция routing."""
    return {**copy.deepcopy(FILE_TEMPLATE), "routing": copy.deepcopy(routing)}


def _v2ray_json_conf(*, default_body: bool = True) -> V2rayJsonConfig:
    """default_body=False — пустое тело документа `default` (его нет в карте тел)."""
    configs = {BS_CONFIG_ID: _config_document(BS_ROUTING)}
    if default_body:
        configs[DEFAULT_CONFIG_ID] = _config_document(DEFAULT_ROUTING)
    # EMPTY_CONFIG_ID есть среди документов, но тела у него нет — в карту не попадает.
    conf = V2rayJsonConfig(configs=configs, default_id=DEFAULT_CONFIG_ID)
    conf._file_template_cache = copy.deepcopy(FILE_TEMPLATE)
    return conf


def _routing(conf: V2rayJsonConfig) -> dict:
    return conf.config[-1]["routing"]


def _routing_domains(conf: V2rayJsonConfig) -> list[str]:
    return [rule.get("domain", [""])[0] for rule in conf.config[-1]["routing"]["rules"]]


def _proxy_addresses(assembled_config: dict) -> list[str]:
    """Адреса всех proxy-outbound'ов (не dialer/direct/block) собранного конфига."""
    return [o["settings"]["vnext"][0]["address"] for o in assembled_config["outbounds"] if o["tag"].startswith("proxy")]


def test_v2ray_json_single_address_bs_host_gets_bs_routing(xray_stub):
    """Документ БС-хоста доходит до V2rayJsonConfig.add → рендерится он."""
    xray_stub([_host("bs.example.com", node_ids=[BS_NODE_ID], client_config_id=BS_CONFIG_ID)])
    conf = _v2ray_json_conf()

    _render(conf, BsContext.empty())

    assert len(conf.config) == 1
    assert _routing_domains(conf) == ["bs"]


def test_v2ray_json_balanced_bs_host_gets_bs_routing(xray_stub):
    """Мульти-адресный (балансируемый) БС-хост → add_balanced(client_config_id=...)."""
    xray_stub([_host("bs1.example.com", "bs2.example.com", node_ids=[BS_NODE_ID], client_config_id=BS_CONFIG_ID)])
    conf = _v2ray_json_conf()

    _render(conf, BsContext.empty())

    cfg = conf.config[-1]
    proxy_tags = [o["tag"] for o in cfg["outbounds"] if o["tag"].startswith("proxy")]
    assert proxy_tags == ["proxy", "proxy-1"]  # балансировка сохранена
    assert "bs" in _routing_domains(conf)  # и БС-routing тоже


def test_v2ray_json_non_bs_host_gets_default_routing(xray_stub):
    xray_stub([_host("plain.example.com", node_ids=[OTHER_NODE_ID], client_config_id=DEFAULT_CONFIG_ID)])
    conf = _v2ray_json_conf()

    _render(conf, BsContext.empty())

    assert _routing_domains(conf) == ["default"]


def test_host_without_config_falls_back_to_default_document(xray_stub):
    """Прод-состояние: миграция вешает документ только на хосты БС-нод, остальные — NULL.

    Такой хост обязан получить документ `default`, а не файловый шаблон: до переезда
    он получал шаблон с вклеенным sub_routing_json_default.
    """
    xray_stub([_host("plain.example.com", node_ids=[OTHER_NODE_ID], client_config_id=None)])
    conf = _v2ray_json_conf()

    _render(conf, BsContext.empty())

    assert _routing_domains(conf) == ["default"]


def test_v2ray_json_host_without_nodes_falls_back_to_default_document(xray_stub):
    """Хост без привязанных нод и без собственной привязки: фолбэк на документ `default`."""
    xray_stub([_host("orphan.example.com", node_ids=[], client_config_id=None)])
    conf = _v2ray_json_conf()

    _render(conf, BsContext.empty())

    assert _routing_domains(conf) == ["default"]


def test_two_hosts_sharing_default_document_do_not_leak_outbounds(xray_stub):
    """Документ `default` в conf.configs — ОБЩИЙ объект: сразу два хоста без своей
    привязки (client_config_id=None, после миграции — все не-БС-хосты) фолбэком идут
    на один и тот же документ. Без copy.deepcopy(base) в _assemble_config первый
    сервер дописал бы свой outbound прямо в объект из карты, и второй сервер получил
    бы СВОЙ + ЧУЖОЙ outbound (унаследованную точку подключения первого хоста), а
    карта документов необратимо испортилась бы для всех следующих подписок. Тест
    ловит именно это: без deepcopy падает и на "чужом outbound", и на мутации карты.
    """
    xray_stub(
        [
            _host("h1.example.com", node_ids=[OTHER_NODE_ID], remark="H1", order=0, client_config_id=None),
            _host("h2.example.com", node_ids=[OTHER_NODE_ID], remark="H2", order=1, client_config_id=None),
        ]
    )
    conf = _v2ray_json_conf()
    default_doc = conf.configs[DEFAULT_CONFIG_ID]
    outbounds_count_before = len(default_doc["outbounds"])

    _render(conf, BsContext.empty())

    assert len(conf.config) == 2
    # у каждого сервера — ровно свой proxy-outbound, а не свой+чужой и не чужой вместо своего
    assert _proxy_addresses(conf.config[0]) == ["h1.example.com"]
    assert _proxy_addresses(conf.config[1]) == ["h2.example.com"]
    # документ в карте conf.configs остался нетронутым: outbounds серверов в нём не осели
    assert len(conf.configs[DEFAULT_CONFIG_ID]["outbounds"]) == outbounds_count_before


def test_assigned_config_with_empty_body_falls_back_to_default_document(xray_stub):
    """Документ НАЗНАЧЕН, но его тело пусто → дефолтный документ.

    У самодостаточных документов пустое тело — это «документ не заполнен», рендерить
    из него нечего: подмены одной секции больше нет. Поэтому пустое тело и ссылка на
    удалённый документ ведут одинаково — фолбэком на `default`. Прод после миграции
    такого состояния не создаёт: пустой sub_routing_json_bs даёт документу `bs` тело
    самого шаблона, а не пустую строку.
    """
    xray_stub([_host("empty.example.com", node_ids=[OTHER_NODE_ID], client_config_id=EMPTY_CONFIG_ID)])
    conf = _v2ray_json_conf()

    _render(conf, BsContext.empty())

    assert _routing_domains(conf) == ["default"]


def test_host_without_config_falls_back_to_file_template_when_default_is_empty(xray_stub):
    """Хост без привязки при ПУСТОМ документе `default` — последняя ступень, файловый шаблон."""
    xray_stub([_host("plain.example.com", node_ids=[OTHER_NODE_ID], client_config_id=None)])
    conf = _v2ray_json_conf(default_body=False)

    _render(conf, BsContext.empty())

    assert _routing(conf) == TEMPLATE_ROUTING


def test_is_bs_never_leaks_into_other_formats(xray_stub):
    """Другие форматы про документы конфига не знают — их conf.add вызывается без них."""
    xray_stub([_host("bs.example.com", node_ids=[BS_NODE_ID], client_config_id=BS_CONFIG_ID)])
    conf = _FakeConf()

    _render(conf, BsContext.empty())

    assert conf.calls[0]["kwargs"] == {}
    assert conf.calls[0]["remark"] == "BS server"


# _FakeConf.add(**kwargs) молча проглотит лишний client_config_id, если isinstance-гвард
# (`isinstance(conf, V2rayJsonConfig)` в share.py) снять — assert kwargs == {} выше
# страхует только сам факт "kwargs пустой", но не докажет, что ДРУГИЕ форматы вообще
# не умеют принять client_config_id. Настоящие ClashConfiguration/ClashMetaConfiguration/
# SingBoxConfiguration/OutlineConfiguration.add() такого параметра не имеют — при снятии
# гварда process_inbounds_and_tags упал бы TypeError'ом (500 на подписке). Прогоняем
# process_inbounds_and_tags с настоящими классами, чтобы рендер БС-хоста в этих форматах
# доказуемо не падал (а при регрессии гварда — падал бы).
@pytest.mark.parametrize(
    "conf_factory",
    [ClashConfiguration, ClashMetaConfiguration, SingBoxConfiguration, OutlineConfiguration],
    ids=["clash", "clash_meta", "singbox", "outline"],
)
def test_is_bs_host_renders_without_error_in_real_non_v2ray_formats(xray_stub, conf_factory):
    xray_stub([_host("bs.example.com", node_ids=[BS_NODE_ID], client_config_id=BS_CONFIG_ID)])
    conf = conf_factory()

    rendered = _render(conf, BsContext.empty())

    assert rendered  # рендер прошёл до конца, а не упал TypeError'ом на лишнем kwarg


# --- build_bs_context: stub_text считается от node-id-пути, а не от адресов ---
# app.db тянет SQLAlchemy-модели и коннект к MySQL — в песочнице недоступен,
# подменяем модулем с фейковым crud (Session/User нужны только как аннотации).
_fake_crud = types.SimpleNamespace(
    get_blocked_bs_node_ids=lambda db, user_id: set(db["blocked"]),
)
_stub_module("app.db", {"Session": dict, "crud": _fake_crud})
_stub_module("app.db.models", {"User": types.SimpleNamespace})

from app.subscription import bs_context_builder  # noqa: E402
from app.subscription.bs_context_builder import build_bs_context  # noqa: E402

BS_SETTINGS = {"sub_bs_limit_server_text": ["Лимит БС исчерпан"]}


@pytest.fixture
def fake_crud(monkeypatch):
    """Заглушка app.db могла не сработать: другой тест (напр. test_record_bs_usage) уже
    импортировал настоящий app.db, и _stub_module тогда ничего не подменяет. Поэтому
    фейковый crud ставим прямо в модуль-потребитель — независимо от порядка импортов."""
    monkeypatch.setattr(bs_context_builder, "crud", _fake_crud)


def test_build_bs_context_sets_stub_text_for_blocked_domain_host(fake_crud):
    """Баг: раньше stub_text брался от адресного множества → у доменного БС-хоста
    заглушка получала ПУСТОЕ имя. Теперь текст зависит от блоков по node_ids."""
    db = {"bs": {BS_NODE_ID}, "blocked": {BS_NODE_ID}}
    bs = build_bs_context(
        db,
        types.SimpleNamespace(id=1),
        is_revoked=False,
        is_expired=False,
        bot_settings=BS_SETTINGS,
    )
    assert bs.blocked_node_ids == frozenset({BS_NODE_ID})
    assert bs.has_blocks is True
    assert bs.stub_text  # имя сервера-заглушки не пустое
    assert bs.is_blocked(_host("bs.example.com", node_ids=[BS_NODE_ID])) is True
    # Признак конфига (раньше bs.is_bs(host)) больше не хранится в BsContext — он
    # читается отдельно, прямо с хоста (host["client_config_id"], NPVPN-2024).


def test_build_bs_context_without_blocks_has_no_stub_text(fake_crud):
    bs = build_bs_context(
        {"bs": {BS_NODE_ID}, "blocked": set()},
        types.SimpleNamespace(id=1),
        is_revoked=False,
        is_expired=False,
        bot_settings=BS_SETTINGS,
    )
    assert bs.has_blocks is False
    assert bs.stub_text == ""


def test_build_bs_context_is_empty_for_revoked_or_expired():
    db = {"bs": {BS_NODE_ID}, "blocked": {BS_NODE_ID}}
    user = types.SimpleNamespace(id=1)
    revoked = build_bs_context(db, user, is_revoked=True, is_expired=False, bot_settings=BS_SETTINGS)
    expired = build_bs_context(db, user, is_revoked=False, is_expired=True, bot_settings=BS_SETTINGS)
    assert revoked == BsContext.empty()
    assert expired == BsContext.empty()


# --- generate_subscription: маппинг формата в StubEndpoint (адрес/порт заглушки БС-лимита) ---
# Регрессия в этом if/elif (например, перестановка веток incy / v2ray-json) отдала бы
# строгим клиентам невалидный endpoint заглушки, поэтому дёргаем НАСТОЯЩИЙ
# generate_subscription и смотрим, какой адрес/порт реально доехал до рендера.


@pytest.fixture
def sub_user(xray_stub, monkeypatch):
    """Юзер для generate_subscription с одним заблокированным БС-хостом в подписке.

    setup_format_variables тянет app.models.user → app.models.admin → app.db (get_db,
    FastAPI-зависимости) — в песочнице conftest.py этого нет; подменяем её тем же
    набором переменных, что и _render выше. Всё остальное в generate_subscription
    (выбор формата, StubEndpoint, V2rayShareLink/V2rayJsonConfig) — настоящее.
    """
    xray_stub([_host("bs.example.com", node_ids=[BS_NODE_ID])])
    monkeypatch.setattr(
        share,
        "setup_format_variables",
        lambda extra_data: defaultdict(lambda: "<missing>", {"USERNAME": "u1", "BOT_USERNAME": "probe-bot"}),
    )
    protocol = _Protocol()
    return types.SimpleNamespace(proxies={protocol: _ProxySettings()}, inbounds={protocol: [BS_TAG]})


def _generate(user, config_format: str) -> str:
    return share.generate_subscription(
        user=user,
        config_format=config_format,
        as_base64=False,
        reverse=False,
        bs=_blocked_ctx(),
    )


def _v2ray_stub_endpoint(config: str) -> tuple[str, int]:
    """Адрес/порт из vless-ссылки заглушки: vless://<id>@<address>:<port>?..."""
    assert urllib.parse.quote(STUB_TEXT) in config  # это именно заглушка лимита (remark в #фрагменте)
    endpoint = config.split("@", 1)[1].split("?", 1)[0]
    address, port = endpoint.rsplit(":", 1)
    return address, int(port)


def _json_stub_endpoint(config: str) -> tuple[str, int]:
    (profile,) = json.loads(config)
    assert profile["remarks"] == STUB_TEXT
    vnext = profile["outbounds"][0]["settings"]["vnext"][0]
    return vnext["address"], vnext["port"]


def test_generate_subscription_v2ray_uses_zero_stub(sub_user):
    assert _v2ray_stub_endpoint(_generate(sub_user, "v2ray")) == (ZERO_STUB.address, ZERO_STUB.port)


def test_generate_subscription_v2ray_json_uses_json_stub(sub_user):
    assert _json_stub_endpoint(_generate(sub_user, "v2ray-json")) == (JSON_STUB_ADDRESS, JSON_STUB_PORT)


def test_generate_subscription_incy_with_custom_json_uses_json_stub(sub_user, monkeypatch):
    """USE_CUSTOM_JSON_DEFAULT=True → incy рендерится как v2ray-json → JSON-заглушка."""
    monkeypatch.setattr(panel_config, "USE_CUSTOM_JSON_DEFAULT", True)

    assert _json_stub_endpoint(_generate(sub_user, "incy")) == (JSON_STUB_ADDRESS, JSON_STUB_PORT)


def test_generate_subscription_incy_without_custom_json_uses_incy_stub(sub_user, monkeypatch):
    """USE_CUSTOM_JSON_DEFAULT=False → incy рендерится как v2ray (base64) → INCY-заглушка,
    а НЕ 0.0.0.0:0: incy-клиент отбрасывает невалидный endpoint целиком."""
    monkeypatch.setattr(panel_config, "USE_CUSTOM_JSON_DEFAULT", False)

    config = base64.b64decode(_generate(sub_user, "incy")).decode()  # incy/v2ray всегда base64

    assert _v2ray_stub_endpoint(config) == (INCY_STUB_ADDRESS, INCY_STUB_PORT)


def test_bs_bar_total_does_not_shrink_as_usage_grows():
    """Регресс NPVPN-1768: у Happ total фиксирован, растёт только used."""
    from app.xray.bs_limit import monthly_effective_limit, pick_bs_bar

    gb = 1024**3
    ceiling = monthly_effective_limit(3 * gb, 10 * gb)

    assert pick_bs_bar(0, ceiling) == (0, 13 * gb)
    assert pick_bs_bar(8 * gb, ceiling) == (8 * gb, 13 * gb)
    assert pick_bs_bar(13 * gb, ceiling) == (13 * gb, 13 * gb)


# --- NPVPN-2072: сужение адресов хоста -------------------------------------

from app.subscription.address_context import AddressContext  # noqa: E402

FOUR_ADDRESSES = ("10.0.0.1", "10.0.0.2", "10.0.0.3", "10.0.0.4")
FOUR_NODE_IDS = [11, 22, 33, 44]


def _subset_ctx(weights=None, user_id=4242, exhausted=frozenset()):
    """Пер-юзерная часть контекста. Размер подмножества задаётся на ХОСТЕ (см. _host).

    rotation_days=1 у тестовых хостов, поэтому эпоха начинается в те же сутки
    (epoch_start_day при периоде 1 равен day_index) и снимок кладётся под ключ 0.
    """
    return AddressContext(
        user_id=user_id,
        day_index=0,
        weights_by_day={0: weights or {}},
        exhausted=exhausted,
        enabled=True,
    )


def _balanced_addresses(rendered_json) -> list[str]:
    """Адреса proxy-outbound'ов, но только из БАЛАНСИРУЕМЫХ профилей (add_balanced).

    Одноадресный хост тоже рендерится через один outbound с тегом "proxy"
    (см. V2rayJsonConfig.add/_build_proxy_outbound) — его отличает от balanced-профиля
    только то, что там proxy-outbound ровно один. add_balanced даёт "proxy", "proxy-1",
    "proxy-2", ... — то есть >= 2 proxy-outbound'а в одном profile. Именно по этому
    признаку отсеиваем одноадресные хосты (иначе size=1 ложно "видел бы" балансировку).
    """
    addresses: list[str] = []
    for profile in rendered_json:
        proxy_outbounds = [
            ob
            for ob in profile.get("outbounds", [])
            if str(ob.get("tag", "")) == "proxy" or str(ob.get("tag", "")).startswith("proxy-")
        ]
        if len(proxy_outbounds) < 2:
            continue
        for outbound in proxy_outbounds:
            vnext = outbound.get("settings", {}).get("vnext")
            if vnext:
                addresses.append(vnext[0]["address"])
    return addresses


def test_subset_flag_off_renders_identically(xray_stub):
    """Главный тест задачи: выключенный флаг не меняет выдачу.

    Мульти-адресный хост в v2ray-json идёт через add_balanced со ВСЕМ списком
    адресов — именно там «сливаются все IP», и именно это сужение и режет.
    """
    xray_stub([_host(*FOUR_ADDRESSES, node_ids=FOUR_NODE_IDS)])

    baseline = json.loads(_render(_v2ray_json_conf(), BsContext.empty()))
    with_none = json.loads(_render(_v2ray_json_conf(), BsContext.empty(), subset=None))
    disabled = json.loads(_render(_v2ray_json_conf(), BsContext.empty(), subset=AddressContext.disabled()))

    assert with_none == baseline
    assert disabled == baseline
    assert _balanced_addresses(baseline) == list(FOUR_ADDRESSES)


def test_subset_narrows_balanced_addresses(xray_stub):
    xray_stub([_host(*FOUR_ADDRESSES, node_ids=FOUR_NODE_IDS, subset_size=2)])
    rendered = json.loads(_render(_v2ray_json_conf(), BsContext.empty(), subset=_subset_ctx()))
    picked = _balanced_addresses(rendered)
    assert len(picked) == 2
    assert set(picked) <= set(FOUR_ADDRESSES)
    # Порядок исходного списка сохранён.
    assert picked == [a for a in FOUR_ADDRESSES if a in picked]


def test_subset_is_stable_between_renders(xray_stub):
    xray_stub([_host(*FOUR_ADDRESSES, node_ids=FOUR_NODE_IDS, subset_size=2)])
    first = json.loads(_render(_v2ray_json_conf(), BsContext.empty(), subset=_subset_ctx()))
    second = json.loads(_render(_v2ray_json_conf(), BsContext.empty(), subset=_subset_ctx()))
    assert _balanced_addresses(first) == _balanced_addresses(second)


def test_subset_follows_weights(xray_stub):
    """Исчерпанные ноды уступают тем, у кого остался лимит."""
    xray_stub([_host(*FOUR_ADDRESSES, node_ids=FOUR_NODE_IDS, subset_size=2)])
    drained = {11: 0.0, 22: 0.0, 33: 10**12, 44: 10**12}
    rendered = json.loads(_render(_v2ray_json_conf(), BsContext.empty(), subset=_subset_ctx(weights=drained)))
    assert set(_balanced_addresses(rendered)) == {"10.0.0.3", "10.0.0.4"}


def test_subset_size_one_disables_balancer(xray_stub):
    """N = 1 разрешён; следствие — balanced-ветка не срабатывает вовсе."""
    xray_stub([_host(*FOUR_ADDRESSES, node_ids=FOUR_NODE_IDS, subset_size=1)])
    rendered = json.loads(_render(_v2ray_json_conf(), BsContext.empty(), subset=_subset_ctx()))
    assert _balanced_addresses(rendered) == []


def test_blocked_bs_host_ignores_subset(xray_stub):
    """Заблокированный БС-хост становится заглушкой — суженный список не используется.

    Это единственный смысл прежнего исключения БС-хостов из сужения (bs.is_bs(host)),
    который остаётся верным и после его снятия (NPVPN-2024 убрал is_bs из BsContext):
    заблокированный хост уходит в ветку bs.is_blocked() ДО того, как суженный список
    вообще попал бы в рендер, так что subset здесь ни на что не влияет."""
    xray_stub([_host(*FOUR_ADDRESSES, node_ids=[BS_NODE_ID], subset_size=1)])
    bs = BsContext(blocked_node_ids=frozenset({BS_NODE_ID}), stub_text=STUB_TEXT)

    with_subset = json.loads(_render(_v2ray_json_conf(), bs, subset=_subset_ctx()))
    without = json.loads(_render(_v2ray_json_conf(), bs, subset=AddressContext.disabled()))

    assert with_subset == without


def test_two_hosts_get_their_own_subset_size(xray_stub):
    """Ради чего настройка уехала на хост: одна локация отдаёт 2 адреса, другая 3."""
    xray_stub(
        [
            _host(*FOUR_ADDRESSES, node_ids=FOUR_NODE_IDS, remark="two", subset_size=2),
            _host(*FOUR_ADDRESSES, node_ids=FOUR_NODE_IDS, remark="three", order=1, subset_size=3),
        ]
    )
    rendered = json.loads(_render(_v2ray_json_conf(), BsContext.empty(), subset=_subset_ctx()))
    per_profile = []
    for profile in rendered:
        proxies = [
            ob
            for ob in profile.get("outbounds", [])
            if str(ob.get("tag", "")) == "proxy" or str(ob.get("tag", "")).startswith("proxy-")
        ]
        if len(proxies) >= 2:
            per_profile.append(len(proxies))
    assert sorted(per_profile) == [2, 3]


def test_exhausted_node_is_not_rendered(xray_stub):
    """Порог исчерпания режет ноду в живой выдаче, а не просто понижает ей вес."""
    xray_stub([_host(*FOUR_ADDRESSES, node_ids=FOUR_NODE_IDS, subset_size=2)])
    rendered = json.loads(
        _render(_v2ray_json_conf(), BsContext.empty(), subset=_subset_ctx(exhausted=frozenset({11, 22})))
    )
    assert set(_balanced_addresses(rendered)) == {"10.0.0.3", "10.0.0.4"}

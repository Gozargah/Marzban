"""Экспорт состояния нод в Prometheus (NPVPN-1614)."""

import sys
import types
from contextlib import contextmanager
from datetime import datetime

import pytest
from sqlalchemy import create_engine, update
from sqlalchemy.orm import Session
from sqlalchemy.pool import StaticPool

for _name, _module in list(sys.modules.items()):
    if _name.startswith("app.") and not hasattr(_module, "__file__") and not hasattr(_module, "__path__"):
        del sys.modules[_name]

_share_stub = types.ModuleType("app.subscription.share")
_share_stub.generate_v2ray_links = lambda *args, **kwargs: []
sys.modules.setdefault("app.subscription.share", _share_stub)

from app.db.base import Base  # noqa: E402
from app.db.models import CascadeRoute, Node, ProxyHost, ProxyInbound  # noqa: E402
from app.models.node import NodeStatus  # noqa: E402
from app.utils.node_metrics import NodeRoleCollector, NodeUpCollector  # noqa: E402

if sys.modules.get("app.subscription.share") is _share_stub:
    del sys.modules["app.subscription.share"]


def _node(node_id: int, name: str, status: NodeStatus, address: str = "127.0.0.1") -> Node:
    return Node(
        id=node_id,
        name=name,
        address=address,
        port=62050,
        api_port=62051,
        status=status,
        created_at=datetime.utcnow(),
    )


@pytest.fixture
def session_factory():
    engine = create_engine("sqlite://", connect_args={"check_same_thread": False}, poolclass=StaticPool)
    Base.metadata.create_all(engine)
    session = Session(engine)
    session.add(_node(1, "marzban-de-1", NodeStatus.connected))
    session.add(_node(2, "marzban-nl-2", NodeStatus.error))
    session.add(_node(3, "marzban-fr-3", NodeStatus.connecting))
    session.add(_node(4, "marzban-old-4", NodeStatus.disabled))
    session.commit()

    @contextmanager
    def factory():
        yield session

    yield factory
    session.close()


def _samples(collector: NodeUpCollector) -> dict[str, float]:
    return {sample.labels["name"]: sample.value for family in collector.collect() for sample in family.samples}


def test_connected_node_is_up(session_factory):
    assert _samples(NodeUpCollector(session_factory))["marzban-de-1"] == 1.0


def test_error_and_connecting_nodes_are_down(session_factory):
    samples = _samples(NodeUpCollector(session_factory))

    assert samples["marzban-nl-2"] == 0.0
    assert samples["marzban-fr-3"] == 0.0


def test_disabled_node_is_not_exported(session_factory):
    # Админ выключил ноду осознанно: это не авария и не простой, иначе она
    # тянула бы вниз и процент доступности, и суточную статистику.
    assert "marzban-old-4" not in _samples(NodeUpCollector(session_factory))


def test_metric_name_and_labels(session_factory):
    families = list(NodeUpCollector(session_factory).collect())

    assert len(families) == 1
    assert families[0].name == "marzban_node_up"
    assert families[0].samples[0].labels == {"name": "marzban-de-1"}


def test_db_failure_does_not_break_scrape():
    # /metrics собирается одним обходом всех коллекторов: исключение отсюда
    # уронило бы весь эндпоинт, включая метрики пула и HTTP.
    @contextmanager
    def broken_factory():
        raise RuntimeError("db is down")
        yield  # pragma: no cover

    assert list(NodeUpCollector(broken_factory).collect()) == []


LIVE_TAG = "VLESS TCP REALITY"
DEAD_TAG = "CDN_XHTTP"
# Тег есть в живом конфиге, но все его хосты выключены — раздающих хостов нет.
OFF_TAG = "VMESS WS"
CASCADE_TAG = "CASCADE_IN"


def _host(
    host_id: int,
    tag: str,
    *,
    nodes: list[Node],
    disabled: bool | None = False,
    address: str = "example.com",
) -> ProxyHost:
    host = ProxyHost(id=host_id, remark=f"host-{host_id}", address=address, inbound_tag=tag, is_disabled=disabled)
    host.nodes = nodes
    return host


def _route(route_id: int, entry: Node, exit_: Node, entry_tag: str) -> CascadeRoute:
    return CascadeRoute(
        id=route_id,
        entry_node_id=entry.id,
        exit_node_id=exit_.id,
        entry_inbound_tag=entry_tag,
        cascade_inbound_tag=CASCADE_TAG,
    )


@pytest.fixture
def role_session_factory():
    engine = create_engine("sqlite://", connect_args={"check_same_thread": False}, poolclass=StaticPool)
    Base.metadata.create_all(engine)
    session = Session(engine)
    live = _node(1, "live", NodeStatus.connected)
    orphan = _node(2, "orphan", NodeStatus.connected)
    behind_disabled = _node(3, "behind-disabled", NodeStatus.error)
    ghost = _node(4, "ghost", NodeStatus.connected)
    mixed = _node(5, "mixed", NodeStatus.connected)
    switched_off = _node(6, "switched-off", NodeStatus.disabled)
    null_flag = _node(7, "null-flag", NodeStatus.connecting)
    # Пути 2 и 3: ни у одной из нод ниже нет связей в host_nodes.
    static = _node(8, "static", NodeStatus.connected, address="10.0.0.4")
    static_listed = _node(9, "static-listed", NodeStatus.connected, address="10.0.0.5")
    static_disabled_host = _node(10, "static-disabled-host", NodeStatus.connected, address="10.0.0.6")
    static_dead_tag = _node(11, "static-dead-tag", NodeStatus.connected, address="10.0.0.7")
    domain_mismatch = _node(12, "domain-mismatch", NodeStatus.connected, address="node.example.org")
    cascade_entry = _node(13, "cascade-entry", NodeStatus.connected, address="10.0.1.1")
    cascade_exit = _node(14, "cascade-exit", NodeStatus.connected, address="10.0.1.2")
    dead_entry = _node(15, "dead-entry", NodeStatus.connected, address="10.0.1.3")
    dead_exit = _node(16, "dead-exit", NodeStatus.connected, address="10.0.1.4")
    off_entry = _node(17, "off-entry", NodeStatus.connected, address="10.0.1.5")
    off_exit = _node(18, "off-exit", NodeStatus.connected, address="10.0.1.6")
    session.add_all(
        [
            live,
            orphan,
            behind_disabled,
            ghost,
            mixed,
            switched_off,
            null_flag,
            static,
            static_listed,
            static_disabled_host,
            static_dead_tag,
            domain_mismatch,
            cascade_entry,
            cascade_exit,
            dead_entry,
            dead_exit,
            off_entry,
            off_exit,
        ]
    )
    session.add_all(
        [
            ProxyInbound(id=1, tag=LIVE_TAG),
            ProxyInbound(id=2, tag=DEAD_TAG),
            ProxyInbound(id=3, tag=OFF_TAG),
            ProxyInbound(id=4, tag=CASCADE_TAG),
        ]
    )
    session.add_all(
        [
            _host(1, LIVE_TAG, nodes=[live, mixed, switched_off]),
            _host(2, LIVE_TAG, nodes=[behind_disabled], disabled=True),
            _host(3, DEAD_TAG, nodes=[ghost, mixed]),
            _host(4, LIVE_TAG, nodes=[null_flag], disabled=False),
            _host(5, LIVE_TAG, nodes=[], address="10.0.0.4"),
            _host(6, LIVE_TAG, nodes=[], address="10.0.0.9, 10.0.0.5"),
            _host(7, LIVE_TAG, nodes=[], address="10.0.0.6", disabled=True),
            _host(8, DEAD_TAG, nodes=[], address="10.0.0.7"),
            _host(9, LIVE_TAG, nodes=[], address="front.example.org"),
            # Динамический хост: адреса берёт из нод, сам статики не раздаёт.
            _host(10, LIVE_TAG, nodes=[], address=""),
            _host(11, OFF_TAG, nodes=[], address="10.0.9.9", disabled=True),
        ]
    )
    session.add_all(
        [
            _route(1, cascade_entry, cascade_exit, LIVE_TAG),
            _route(2, dead_entry, dead_exit, DEAD_TAG),
            _route(3, off_entry, off_exit, OFF_TAG),
        ]
    )
    session.commit()
    # Явный is_disabled=None ORM заменяет дефолтом колонки (False), поэтому NULL
    # приходится проставлять напрямую — так он и лежит в старых строках боевой БД.
    session.execute(update(ProxyHost).where(ProxyHost.id == 4).values(is_disabled=None))
    session.commit()

    @contextmanager
    def factory():
        yield session

    yield factory
    session.close()


def _roles(collector: NodeRoleCollector) -> list[tuple[str, str]]:
    return sorted(
        (sample.labels["name"], sample.labels["role"]) for family in collector.collect() for sample in family.samples
    )


def _role_collector(factory) -> NodeRoleCollector:
    return NodeRoleCollector(factory, live_tags=lambda: {LIVE_TAG, OFF_TAG})


def test_node_behind_live_host_is_primary(role_session_factory):
    assert ("live", "primary") in _roles(_role_collector(role_session_factory))


def test_node_without_hosts_is_reserve(role_session_factory):
    assert ("orphan", "reserve") in _roles(_role_collector(role_session_factory))


def test_disabled_host_does_not_make_node_primary(role_session_factory):
    assert ("behind-disabled", "reserve") in _roles(_role_collector(role_session_factory))


def test_host_under_dead_tag_does_not_make_node_primary(role_session_factory):
    # Призрачные хосты под тегами, которых нет в живом xray-конфиге, лежат в hosts
    # с is_disabled=0, но клиентам не раздаются (их не видно и в UI панели).
    assert ("ghost", "reserve") in _roles(_role_collector(role_session_factory))


def test_one_live_host_is_enough_and_series_is_single(role_session_factory):
    roles = _roles(_role_collector(role_session_factory))

    assert ("mixed", "primary") in roles
    assert [name for name, _ in roles].count("mixed") == 1


def test_host_with_null_disabled_flag_counts_as_enabled(role_session_factory):
    assert ("null-flag", "primary") in _roles(_role_collector(role_session_factory))


def test_disabled_node_has_no_role(role_session_factory):
    assert "switched-off" not in {name for name, _ in _roles(_role_collector(role_session_factory))}


def test_role_metric_name_labels_and_value(role_session_factory):
    families = list(_role_collector(role_session_factory).collect())

    assert [family.name for family in families] == ["marzban_node_role"]
    assert {frozenset(sample.labels) for sample in families[0].samples} == {frozenset({"name", "role"})}
    assert {sample.value for sample in families[0].samples} == {1.0}


def test_role_db_failure_does_not_break_scrape():
    @contextmanager
    def broken_factory():
        raise RuntimeError("db is down")
        yield  # pragma: no cover

    assert list(NodeRoleCollector(broken_factory, live_tags=lambda: {LIVE_TAG}).collect()) == []


def test_live_tags_failure_does_not_break_scrape(role_session_factory):
    # Нет роли — нода считается основной на стороне алертов, поэтому молчаливый
    # пустой ответ безопасен, а исключение уронило бы весь /metrics.
    def broken_tags():
        raise RuntimeError("xray config is not loaded")

    assert list(NodeRoleCollector(role_session_factory, live_tags=broken_tags).collect()) == []


def test_node_behind_static_address_of_live_host_is_primary(role_session_factory):
    # Статический адрес хоста отдаётся клиентам независимо от host_nodes, а
    # привязка к хосту изменила бы visible_nodes (БС-признак, закрепления
    # NPVPN-2072) — поэтому статика сама по себе делает ноду основной.
    assert ("static", "primary") in _roles(_role_collector(role_session_factory))


def test_static_address_list_is_split_by_comma_and_stripped(role_session_factory):
    assert ("static-listed", "primary") in _roles(_role_collector(role_session_factory))


def test_static_address_of_disabled_host_does_not_make_node_primary(role_session_factory):
    assert ("static-disabled-host", "reserve") in _roles(_role_collector(role_session_factory))


def test_static_address_under_dead_tag_does_not_make_node_primary(role_session_factory):
    assert ("static-dead-tag", "reserve") in _roles(_role_collector(role_session_factory))


def test_domain_static_address_matches_only_equal_node_address(role_session_factory):
    assert ("domain-mismatch", "reserve") in _roles(_role_collector(role_session_factory))


def test_cascade_entry_and_exit_of_served_tag_are_primary(role_session_factory):
    # Exit-нода обслуживает клиентов entry-ноды без собственного хоста.
    roles = _roles(_role_collector(role_session_factory))

    assert ("cascade-entry", "primary") in roles
    assert ("cascade-exit", "primary") in roles


def test_cascade_under_dead_tag_does_not_make_nodes_primary(role_session_factory):
    roles = _roles(_role_collector(role_session_factory))

    assert ("dead-entry", "reserve") in roles
    assert ("dead-exit", "reserve") in roles


def test_cascade_under_tag_with_only_disabled_hosts_does_not_make_nodes_primary(role_session_factory):
    roles = _roles(_role_collector(role_session_factory))

    assert ("off-entry", "reserve") in roles
    assert ("off-exit", "reserve") in roles


def test_every_enabled_node_has_exactly_one_role(role_session_factory):
    names = [name for name, _ in _roles(_role_collector(role_session_factory))]

    assert len(names) == len(set(names)) == 17


def test_empty_live_tags_yield_nothing(role_session_factory):
    # Пустой живой конфиг — роль неизвестна, а не «весь парк резервный»:
    # иначе алерты по всем нодам замолчали бы разом.
    assert list(NodeRoleCollector(role_session_factory, live_tags=lambda: set()).collect()) == []

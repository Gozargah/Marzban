"""Экспортёр состояния нод в Prometheus (NPVPN-1614).

Читает nodes в момент скрейпа — как _DbPoolCollector в db_metrics.py: никаких
фоновых задач и никакой нагрузки между скрейпами. История доступности живёт в
Prometheus (retention 15d), а не в панели — в самой БД лежит только текущий
статус.

Лейбл ровно один — name. Изменчивые поля (status, message, address) в лейблы не
кладём: лейбл входит в идентичность временного ряда, и меняющийся лейбл рвал бы
ряд на куски, ломая avg_over_time.

Роль ноды (NPVPN-2187) — отдельная метрика marzban_node_role{name, role}, а не
лейбл на marzban_node_up: роль меняется при перепривязке хостов, и её смена
порвала бы ряд доступности. По роли потребители (алерты, дашборд, сводка в
боте) отсекают резервные ноды — те, до которых клиент не доходит ни через один
живой хост (определение — в докстринге NodeRoleCollector).
"""

from __future__ import annotations

import logging
from collections.abc import Callable, Iterable, Iterator
from contextlib import AbstractContextManager

from prometheus_client import REGISTRY
from prometheus_client.core import GaugeMetricFamily

logger = logging.getLogger(__name__)

METRIC_NAME = "marzban_node_up"


class NodeUpCollector:
    """Отдаёт marzban_node_up{name} = 1 для connected, 0 для connecting/error."""

    def __init__(self, session_factory: Callable[[], AbstractContextManager]):
        self._session_factory = session_factory

    def collect(self) -> Iterator[GaugeMetricFamily]:
        try:
            rows = self._read_rows()
        except Exception as exc:
            # Скрейп собирает все коллекторы одним обходом: исключение отсюда
            # уронило бы весь /metrics, а не только метрики нод.
            logger.warning("[metrics] node collector failed: %s", exc)
            return

        gauge = GaugeMetricFamily(
            METRIC_NAME,
            "Node is connected (1) or not (0); disabled nodes are excluded",
            labels=["name"],
        )
        for name, status in rows:
            gauge.add_metric([name], 1.0 if status == "connected" else 0.0)
        yield gauge

    def _read_rows(self) -> list[tuple[str, str]]:
        # Импорт ленивый: модуль не должен тянуть модели и движок на импорте,
        # иначе он неимпортируем в тестовой песочнице (tests/conftest.py).
        from app.db.models import Node
        from app.models.node import NodeStatus

        with self._session_factory() as db:
            rows = db.query(Node.name, Node.status).filter(Node.status != NodeStatus.disabled).all()

        return [(name, getattr(status, "value", status)) for name, status in rows]


ROLE_METRIC_NAME = "marzban_node_role"


def _xray_inbound_tags() -> Iterable[str]:
    # Видимый набор хостов панели задаёт живой xray-конфиг (routers/system.py), а
    # не hosts.is_disabled и не таблица inbounds: в hosts лежат призрачные хосты
    # под тегами, которых в конфиге уже нет. Читается на каждом скрейпе, потому что
    # конфиг перечитывается при перезапуске ядра.
    from app import xray

    return xray.config.inbounds_by_tag.keys()


class NodeRoleCollector:
    """Отдаёт marzban_node_role{name, role} = 1 (NPVPN-2187).

    Раздающий хост — хост, который не выключен (NULL в is_disabled = включён) и
    чей inbound_tag есть в живом xray-конфиге. Не-disabled нода — primary, если
    клиент достигает её хотя бы одним из трёх путей:

    1. связь в host_nodes с раздающим хостом;
    2. статический адрес раздающего хоста: Node.address входит в hosts.address,
       разбитый по запятой (как в resolve_host_addresses). Такой хост отдаёт свой
       адрес клиентам независимо от host_nodes, а привязка к нему поменяла бы
       семантику visible_nodes (БС-признак, закрепления NPVPN-2072), так что
       «привязать вручную» — не обход;
    3. cascade_routes: нода — entry или exit маршрута, чей entry_inbound_tag —
       тег раздающего хоста. Exit-нода обслуживает клиентов entry-ноды без
       собственного хоста.

    reserve — любая другая не-disabled нода. Ошибка определения роли и пустой
    набор живых тегов отдают пустой ответ: потребители исключают только ЯВНО
    резервные ноды, так что сбой уходит в шум, а не в тишину.

    Выкатка: до релиза этой версии панели на прод каждая реально раздающая нода
    должна достигаться одним из трёх путей (на opl — привязать ноды к хостам),
    иначе она станет резервной и её алерты замолчат. После релиза проверить
    marzban_node_role{role="reserve"}.
    """

    def __init__(
        self,
        session_factory: Callable[[], AbstractContextManager],
        live_tags: Callable[[], Iterable[str]] | None = None,
    ):
        self._session_factory = session_factory
        self._live_tags = live_tags or _xray_inbound_tags

    def collect(self) -> Iterator[GaugeMetricFamily]:
        try:
            roles = self._read_roles()
        except Exception as exc:
            logger.warning("[metrics] node role collector failed: %s", exc)
            return

        gauge = GaugeMetricFamily(
            ROLE_METRIC_NAME,
            "Node role: primary (served by a live host) or reserve; disabled nodes are excluded",
            labels=["name", "role"],
        )
        for name, role in sorted(roles.items()):
            gauge.add_metric([name, role], 1.0)
        yield gauge

    def _read_roles(self) -> dict[str, str]:
        from app.db.models import CascadeRoute, Node, ProxyHost, host_nodes_association
        from app.models.node import NodeStatus

        live_tags = set(self._live_tags())
        if not live_tags:
            # Пустой конфиг — роль неизвестна. Объявить резервным весь парк значило
            # бы разом заглушить алерты по всем нодам.
            raise RuntimeError("live xray inbound tags are empty")

        # is_disabled nullable: NULL в старых строках = хост включён.
        serving = ProxyHost.is_disabled.is_not(True) & ProxyHost.inbound_tag.in_(live_tags)
        with self._session_factory() as db:
            nodes = db.query(Node.id, Node.name, Node.address).filter(Node.status != NodeStatus.disabled).all()
            hosts = db.query(ProxyHost.inbound_tag, ProxyHost.address).filter(serving).all()
            linked = (
                db.query(host_nodes_association.c.node_id)
                .join(ProxyHost, ProxyHost.id == host_nodes_association.c.host_id)
                .filter(serving)
                .all()
            )
            routes = (
                db.query(CascadeRoute.entry_node_id, CascadeRoute.exit_node_id)
                .filter(CascadeRoute.entry_inbound_tag.in_({tag for tag, _ in hosts}))
                .all()
            )

        served_ids = {node_id for (node_id,) in linked}
        served_ids.update(node_id for route in routes for node_id in route)
        # Пустой address — динамический хост: адреса он берёт из нод (путь 1).
        static_addresses = {part.strip() for _, address in hosts if address for part in address.split(",")}
        static_addresses.discard("")

        return {
            name: "primary" if node_id in served_ids or (address or "").strip() in static_addresses else "reserve"
            for node_id, name, address in nodes
        }


_registered = False


def register(session_factory: Callable[[], AbstractContextManager] | None = None) -> None:
    global _registered
    if _registered:
        return
    if session_factory is None:
        from app.db import GetDB

        session_factory = GetDB
    for collector in (NodeUpCollector(session_factory), NodeRoleCollector(session_factory)):
        try:
            REGISTRY.register(collector)
        except Exception as exc:
            logger.warning("[metrics] failed to register %s: %s", type(collector).__name__, exc)
    _registered = True

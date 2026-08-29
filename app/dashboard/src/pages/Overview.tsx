import { FC, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import {
  flattenInbounds,
  useHosts,
  useInbounds,
  useNodes,
  useNodesUsage,
  useSystemStats,
  useTopUsers,
  useUsageSeries,
} from "xenith/api";
import { Blueprint } from "xenith/Blueprint";
import { formatBytes, formatPercent, groupDigits, measureBytes } from "xenith/format";
import { MeterRow, Panel, PanelEmpty, PanelHead, PanelNote } from "xenith/panels";
import { TrafficChart } from "xenith/TrafficChart";
import { LEVEL_COLORS, useCoreLogs } from "xenith/useCoreLogs";

const KPI_SPARK_W = 86;
const KPI_SPARK_H = 22;

type Kpi = { label: string; value: string; unit?: string; delta: string; spark?: string };

/** Polyline points for the sparkline, scaled into the 86×22 box. */
const sparkline = (values: number[]): string | undefined => {
  if (values.length < 2) return undefined;
  const max = Math.max(...values) || 1;
  return values
    .map((value, index) => {
      const x = (index / (values.length - 1)) * KPI_SPARK_W;
      const y = KPI_SPARK_H - (value / max) * (KPI_SPARK_H - 2) - 1;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");
};

const KpiRow: FC<{ items: Kpi[] }> = ({ items }) => (
  <section className="xn-grid-cells" style={{ gridTemplateColumns: `repeat(${items.length}, 1fr)` }}>
    {items.map((kpi) => (
      <div
        key={kpi.label}
        className="xn-cell"
        style={{ padding: "16px 18px 14px", display: "flex", flexDirection: "column", gap: 8 }}
      >
        <span style={{ fontSize: 10, letterSpacing: "0.14em", textTransform: "uppercase", color: "var(--xn-accent-700)" }}>
          {kpi.label}
        </span>
        <div style={{ display: "flex", alignItems: "flex-end", gap: 8 }}>
          <span className="xn-heading" style={{ fontSize: 36, lineHeight: 0.9 }}>
            {kpi.value}
          </span>
          {kpi.unit && (
            <span style={{ fontSize: 12, color: "var(--xn-neutral-600)", paddingBottom: 3 }}>{kpi.unit}</span>
          )}
        </div>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
          <span style={{ fontSize: 11.5, color: "var(--xn-neutral-700)" }}>{kpi.delta}</span>
          {kpi.spark && (
            <svg
              width={KPI_SPARK_W}
              height={KPI_SPARK_H}
              viewBox={`0 0 ${KPI_SPARK_W} ${KPI_SPARK_H}`}
              fill="none"
              stroke="var(--xn-accent-500)"
              strokeWidth="1.5"
              style={{ flex: "none" }}
            >
              <polyline points={kpi.spark} />
            </svg>
          )}
        </div>
      </div>
    ))}
  </section>
);

export const Overview: FC = () => {
  const { t } = useTranslation();
  const { data: system } = useSystemStats();
  const { data: series } = useUsageSeries("24h");
  const { data: nodes, isLoading: nodesLoading } = useNodes();
  const { data: nodesUsage } = useNodesUsage();
  const { data: inbounds, isLoading: inboundsLoading } = useInbounds();
  const { data: hosts } = useHosts();
  const { data: topUsers, isLoading: usersLoading } = useTopUsers(5);
  const { logs } = useCoreLogs(6);

  const dayTraffic = useMemo(
    () => (series?.points || []).reduce((sum, point) => sum + point.uplink + point.downlink, 0),
    [series],
  );
  const trafficMeasure = measureBytes(dayTraffic);
  const connectedNodes = (nodes || []).filter((node) => node.status === "connected").length;
  const degradedNodes = (nodes || []).filter((node) => node.status === "error").length;

  const kpis: Kpi[] = [
    {
      label: t("xenith.kpi.activeUsers"),
      value: groupDigits(system?.users_active || 0),
      unit: t("xenith.kpi.ofTotal", { total: groupDigits(system?.total_user || 0) }),
      delta: t("xenith.kpi.onlineDay", { total: system?.online_users || 0 }),
    },
    {
      label: t("xenith.kpi.traffic24h"),
      value: trafficMeasure.value,
      unit: trafficMeasure.unit,
      delta: t("xenith.kpi.lifetime", { total: formatBytes((system?.incoming_bandwidth || 0) + (system?.outgoing_bandwidth || 0)) }),
      spark: sparkline((series?.points || []).map((point) => point.uplink + point.downlink)),
    },
    {
      label: t("xenith.kpi.nodesOnline"),
      value: `${connectedNodes}/${nodes?.length || 0}`,
      delta: degradedNodes
        ? t("xenith.kpi.degraded", { total: degradedNodes })
        : t("xenith.kpi.noDegradations"),
    },
    {
      label: t("xenith.kpi.load"),
      value: String(Math.round(system?.cpu_usage || 0)),
      unit: "% CPU",
      delta: t("xenith.kpi.memory", {
        used: formatBytes(system?.mem_used || 0),
        total: formatBytes(system?.mem_total || 0),
      }),
    },
  ];

  const usageByNode = useMemo(() => {
    const map = new Map<string, number>();
    (nodesUsage?.usages || []).forEach((usage) => {
      map.set(usage.node_name, usage.uplink + usage.downlink);
    });
    return map;
  }, [nodesUsage]);
  const peakNodeUsage = Math.max(1, ...Array.from(usageByNode.values()));

  const inboundRows = useMemo(() => flattenInbounds(inbounds), [inbounds]);

  const maxUserTraffic = Math.max(1, ...(topUsers?.users || []).map((user) => user.used_traffic));

  return (
    <>
      <KpiRow items={kpis} />

      <section className="xn-grid-split">
        <TrafficChart />

        <Panel>
          <PanelHead
            title={t("xenith.nodes.title")}
            trailing={
              <PanelNote>
                {t("xenith.nodes.online", { connected: connectedNodes, total: nodes?.length || 0 })}
              </PanelNote>
            }
          />
          <div style={{ display: "flex", flexDirection: "column" }}>
            {(nodes || []).length === 0 && <PanelEmpty loading={nodesLoading}>{t("xenith.nodes.empty")}</PanelEmpty>}
            {(nodes || []).map((node) => {
              const traffic = usageByNode.get(node.name) || 0;
              return (
                <MeterRow
                  key={node.id}
                  lead={
                    <i
                      style={{
                        width: 6,
                        height: 6,
                        flex: "none",
                        display: "block",
                        background:
                          node.status === "connected"
                            ? "var(--xn-accent)"
                            : node.status === "error"
                              ? "var(--xn-neutral-900)"
                              : "var(--xn-neutral-500)",
                      }}
                    />
                  }
                  label={node.name}
                  value={node.xray_version || node.status}
                  percent={formatPercent(traffic, peakNodeUsage)}
                  caption={formatBytes(traffic)}
                />
              );
            })}
          </div>
          <Link to="/nodes" className="xn-btn xn-btn-secondary" style={{ width: "100%", fontSize: 12.5 }}>
            {t("xenith.nodes.all")}
          </Link>
        </Panel>
      </section>

      <section className="xn-grid-split">
        <Blueprint style={{ padding: "18px 20px 20px", display: "flex", flexDirection: "column", gap: 14 }}>
          <PanelHead
            title={t("xenith.inbounds.title")}
            note={t("xenith.inbounds.note", { total: inboundRows.length })}
            trailing={
              <Link to="/inbounds" className="xn-link" style={{ fontSize: 12, letterSpacing: "0.04em" }}>
                {t("xenith.inbounds.manage")} →
              </Link>
            }
          />
          {inboundRows.length === 0 ? (
            <PanelEmpty loading={inboundsLoading} />
          ) : (
            <div className="xn-scroll-x">
              <table className="xn-table" style={{ fontSize: 13 }}>
                <thead>
                  <tr>
                    <th>{t("xenith.inbounds.tag")}</th>
                    <th>{t("xenith.inbounds.protocol")}</th>
                    <th>{t("xenith.inbounds.port")}</th>
                    <th>{t("xenith.inbounds.transport")}</th>
                    <th>{t("xenith.inbounds.hosts")}</th>
                    <th>{t("xenith.inbounds.state")}</th>
                  </tr>
                </thead>
                <tbody>
                  {inboundRows.map((inbound) => (
                    <tr key={inbound.tag}>
                      <td className="xn-mono" style={{ fontSize: 12 }}>
                        {inbound.tag}
                      </td>
                      <td style={{ textTransform: "uppercase" }}>{inbound.protocol}</td>
                      <td className="xn-mono" style={{ fontSize: 12 }}>
                        {inbound.port}
                      </td>
                      <td style={{ color: "var(--xn-neutral-700)" }}>
                        {[inbound.network, inbound.tls].filter(Boolean).join(" · ").toUpperCase()}
                      </td>
                      <td className="xn-mono" style={{ fontSize: 12 }}>
                        {hosts ? (hosts[inbound.tag] || []).length : "—"}
                      </td>
                      <td>
                        <span className="xn-tag xn-tag-accent">{t("xenith.inbounds.active")}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Blueprint>

        <Panel>
          <PanelHead title={t("xenith.top.title")} trailing={<PanelNote>{t("xenith.top.note")}</PanelNote>} />
          <div style={{ display: "flex", flexDirection: "column" }}>
            {(topUsers?.users || []).length === 0 && <PanelEmpty loading={usersLoading} />}
            {(topUsers?.users || []).map((user) => (
              <MeterRow
                key={user.username}
                lead={null}
                label={user.username}
                value={formatBytes(user.used_traffic)}
                percent={
                  user.data_limit
                    ? formatPercent(user.used_traffic, user.data_limit)
                    : formatPercent(user.used_traffic, maxUserTraffic)
                }
                caption={user.data_limit ? formatBytes(user.data_limit) : t("xenith.top.noLimit")}
                captionWidth={84}
                fill="var(--xn-accent-600)"
              />
            ))}
          </div>
        </Panel>
      </section>

      <Blueprint as="section" style={{ padding: "18px 20px", display: "flex", flexDirection: "column", gap: 12 }}>
        <PanelHead
          title={t("xenith.events.title")}
          note={t("xenith.events.note")}
          trailing={
            <Link to="/logs" className="xn-link" style={{ fontSize: 12, letterSpacing: "0.04em" }}>
              {t("xenith.events.open")} →
            </Link>
          }
        />
        {logs.length === 0 ? (
          <PanelEmpty>{t("xenith.events.waiting")}</PanelEmpty>
        ) : (
          <div style={{ display: "flex", flexDirection: "column" }}>
            {logs.map((line) => (
              <div
                key={line.id}
                className="xn-mono"
                style={{
                  display: "grid",
                  gridTemplateColumns: "74px 92px 1fr",
                  gap: 16,
                  padding: "7px 0",
                  borderTop: "1px solid var(--xn-neutral-200)",
                  fontSize: 12,
                }}
              >
                <span style={{ color: "var(--xn-neutral-500)" }}>{line.time}</span>
                <span style={{ letterSpacing: "0.06em", color: LEVEL_COLORS[line.level] || "var(--xn-accent-700)" }}>
                  {line.level}
                </span>
                <span style={{ color: "var(--xn-neutral-800)", overflow: "hidden", textOverflow: "ellipsis" }}>
                  {line.text}
                </span>
              </div>
            ))}
          </div>
        )}
      </Blueprint>
    </>
  );
};

export default Overview;

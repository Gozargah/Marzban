import { FC, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { useNodes, useNodesUsage } from "xenith/api";
import { formatBytes, formatPercent } from "xenith/format";
import { MeterRow, Panel, PanelEmpty, PanelHead, PanelNote } from "xenith/panels";
import { TrafficChart } from "xenith/TrafficChart";

/** The chart at full height, with the per-node split for the same period. */
export const Traffic: FC = () => {
  const { t } = useTranslation();
  const { data: nodes } = useNodes();
  const { data: nodesUsage, isLoading, isError } = useNodesUsage();

  const rows = useMemo(() => {
    const usages = nodesUsage?.usages || [];
    return usages
      .map((usage) => ({ name: usage.node_name, traffic: usage.uplink + usage.downlink }))
      .sort((a, b) => b.traffic - a.traffic);
  }, [nodesUsage]);
  const peak = Math.max(1, ...rows.map((row) => row.traffic));

  return (
    <>
      <TrafficChart height={320} />

      <Panel>
        <PanelHead
          title={t("xenith.traffic.byNode")}
          note={t("xenith.traffic.byNodeNote")}
          trailing={<PanelNote>{t("xenith.nodes.count", { total: nodes?.length || 0 })}</PanelNote>}
        />
        {rows.length === 0 ? (
          <PanelEmpty loading={isLoading}>
            {isError ? t("xenith.traffic.sudoOnly") : t("xenith.empty")}
          </PanelEmpty>
        ) : (
          <div style={{ display: "flex", flexDirection: "column" }}>
            {rows.map((row) => (
              <MeterRow
                key={row.name}
                lead={null}
                label={row.name}
                value={formatBytes(row.traffic)}
                percent={formatPercent(row.traffic, peak)}
                caption={`${formatPercent(row.traffic, peak)}%`}
                captionWidth={48}
              />
            ))}
          </div>
        )}
      </Panel>
    </>
  );
};

export default Traffic;

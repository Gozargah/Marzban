import { FC } from "react";
import { useTranslation } from "react-i18next";
import { NodesDialog } from "components/NodesModal";
import { useDashboard } from "contexts/DashboardContext";
import { useNodes, useNodesUsage } from "xenith/api";
import { Blueprint } from "xenith/Blueprint";
import { formatBytes } from "xenith/format";
import { PanelEmpty, PanelHead } from "xenith/panels";

const STATE_TAG: Record<string, string> = {
  connected: "xn-tag-accent",
  connecting: "xn-tag-neutral",
  error: "xn-tag-outline",
  disabled: "xn-tag-neutral",
};

/** Node inventory: state, address, core version and 24h traffic. */
export const Nodes: FC = () => {
  const { t } = useTranslation();
  const { data: nodes, isLoading } = useNodes();
  const { data: usage } = useNodesUsage();
  const { onEditingNodes } = useDashboard();

  const trafficFor = (name: string) => {
    const entry = (usage?.usages || []).find((item) => item.node_name === name);
    return entry ? entry.uplink + entry.downlink : 0;
  };

  return (
    <>
      <Blueprint style={{ padding: "18px 20px 20px", display: "flex", flexDirection: "column", gap: 14 }}>
        <PanelHead
          title={t("xenith.nodes.title")}
          note={t("xenith.nodes.count", { total: nodes?.length || 0 })}
          trailing={
            <button className="xn-btn xn-btn-primary" style={{ fontSize: 12.5 }} onClick={() => onEditingNodes(true)}>
              {t("xenith.nodes.manage")}
            </button>
          }
        />
        {(nodes || []).length === 0 ? (
          <PanelEmpty loading={isLoading}>{t("xenith.nodes.empty")}</PanelEmpty>
        ) : (
          <div className="xn-scroll-x">
            <table className="xn-table" style={{ fontSize: 13 }}>
              <thead>
                <tr>
                  <th>{t("xenith.nodes.name")}</th>
                  <th>{t("xenith.nodes.address")}</th>
                  <th>{t("xenith.nodes.core")}</th>
                  <th>{t("xenith.nodes.traffic24h")}</th>
                  <th>{t("xenith.nodes.state")}</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {(nodes || []).map((node) => (
                  <tr key={node.id}>
                    <td>{node.name}</td>
                    <td className="xn-mono" style={{ fontSize: 12 }}>
                      {node.address}:{node.port}
                    </td>
                    <td className="xn-mono" style={{ fontSize: 12 }}>
                      {node.xray_version || "—"}
                    </td>
                    <td className="xn-mono" style={{ fontSize: 12 }}>
                      {formatBytes(trafficFor(node.name))}
                    </td>
                    <td>
                      <span className={`xn-tag ${STATE_TAG[node.status] || "xn-tag-neutral"}`}>
                        {t(`xenith.nodes.status.${node.status}`)}
                      </span>
                    </td>
                    <td style={{ textAlign: "right" }}>
                      <button
                        className="xn-btn xn-btn-secondary"
                        style={{ fontSize: 12 }}
                        onClick={() => onEditingNodes(true)}
                      >
                        {t("xenith.edit")}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Blueprint>
      <NodesDialog />
    </>
  );
};

export default Nodes;

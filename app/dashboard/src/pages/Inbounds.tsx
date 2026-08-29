import { FC, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { HostsDialog } from "components/HostsDialog";
import { useDashboard } from "contexts/DashboardContext";
import { flattenInbounds, useHosts, useInbounds } from "xenith/api";
import { Blueprint } from "xenith/Blueprint";
import { PanelEmpty, PanelHead } from "xenith/panels";

/** Inbounds as configured in the core, with the host count each one serves. */
export const Inbounds: FC = () => {
  const { t } = useTranslation();
  const { data: inbounds, isLoading } = useInbounds();
  const { data: hosts, isError: hostsForbidden } = useHosts();
  const { onEditingHosts } = useDashboard();

  const rows = useMemo(() => flattenInbounds(inbounds), [inbounds]);

  return (
    <>
      <Blueprint style={{ padding: "18px 20px 20px", display: "flex", flexDirection: "column", gap: 14 }}>
        <PanelHead
          title={t("xenith.inbounds.title")}
          note={t("xenith.inbounds.note", { total: rows.length })}
          trailing={
            !hostsForbidden && (
              <button className="xn-btn xn-btn-primary" style={{ fontSize: 12.5 }} onClick={() => onEditingHosts(true)}>
                {t("xenith.inbounds.editHosts")}
              </button>
            )
          }
        />
        {rows.length === 0 ? (
          <PanelEmpty loading={isLoading} />
        ) : (
          <div className="xn-scroll-x">
            <table className="xn-table" style={{ fontSize: 13 }}>
              <thead>
                <tr>
                  <th>{t("xenith.inbounds.tag")}</th>
                  <th>{t("xenith.inbounds.protocol")}</th>
                  <th>{t("xenith.inbounds.port")}</th>
                  <th>{t("xenith.inbounds.network")}</th>
                  <th>{t("xenith.inbounds.security")}</th>
                  <th>{t("xenith.inbounds.hosts")}</th>
                  <th>{t("xenith.inbounds.state")}</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((inbound) => (
                  <tr key={inbound.tag}>
                    <td className="xn-mono" style={{ fontSize: 12 }}>
                      {inbound.tag}
                    </td>
                    <td style={{ textTransform: "uppercase" }}>{inbound.protocol}</td>
                    <td className="xn-mono" style={{ fontSize: 12 }}>
                      {inbound.port}
                    </td>
                    <td style={{ color: "var(--xn-neutral-700)", textTransform: "uppercase" }}>{inbound.network}</td>
                    <td style={{ color: "var(--xn-neutral-700)", textTransform: "uppercase" }}>{inbound.tls || "none"}</td>
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
      <HostsDialog />
    </>
  );
};

export default Inbounds;

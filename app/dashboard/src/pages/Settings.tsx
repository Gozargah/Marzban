import { FC } from "react";
import { useTranslation } from "react-i18next";
import { CoreSettingsModal } from "components/CoreSettingsModal";
import { NetworkSettings } from "components/NetworkSettings";
import { useDashboard } from "contexts/DashboardContext";
import { useAdmin, useCoreStats, useSystemStats } from "xenith/api";
import { Blueprint } from "xenith/Blueprint";
import { formatBytes } from "xenith/format";
import { PanelHead } from "xenith/panels";

/** Panel and core facts, plus the entry points into the core config editor. */
export const Settings: FC = () => {
  const { t } = useTranslation();
  const { data: system } = useSystemStats();
  const { data: core } = useCoreStats();
  const { data: admin } = useAdmin();

  const facts: { label: string; value: string }[] = [
    { label: t("xenith.settings.panelVersion"), value: system?.version || "—" },
    { label: t("xenith.settings.coreVersion"), value: core?.version || "—" },
    { label: t("xenith.settings.coreState"), value: core?.started ? t("xenith.running") : t("xenith.stopped") },
    { label: t("xenith.settings.account"), value: admin?.username || "—" },
    { label: t("xenith.settings.role"), value: admin?.is_sudo ? t("xenith.roleSudo") : t("xenith.roleAdmin") },
    {
      label: t("xenith.settings.memory"),
      value: `${formatBytes(system?.mem_used || 0)} / ${formatBytes(system?.mem_total || 0)}`,
    },
  ];

  return (
    <>
      <Blueprint style={{ padding: "18px 20px 20px", display: "flex", flexDirection: "column", gap: 14 }}>
        <PanelHead
          title={t("xenith.settings.title")}
          note={t("xenith.settings.note")}
          trailing={
            admin?.is_sudo && (
              <button
                className="xn-btn xn-btn-primary"
                style={{ fontSize: 12.5 }}
                onClick={() => useDashboard.setState({ isEditingCore: true })}
              >
                {t("xenith.settings.editCore")}
              </button>
            )
          }
        />
        <div className="xn-grid-cells" style={{ gridTemplateColumns: "repeat(3, 1fr)" }}>
          {facts.map((fact) => (
            <div
              key={fact.label}
              className="xn-cell"
              style={{ padding: "16px 18px 14px", display: "flex", flexDirection: "column", gap: 6 }}
            >
              <span className="xn-label">{fact.label}</span>
              <span className="xn-mono" style={{ fontSize: 13.5 }}>
                {fact.value}
              </span>
            </div>
          ))}
        </div>
      </Blueprint>

      {/* Kernel tuning is sudo-only on the API side, so it is not rendered for
          anyone who could only be refused by it. */}
      {admin?.is_sudo && <NetworkSettings />}

      <CoreSettingsModal />
    </>
  );
};

export default Settings;

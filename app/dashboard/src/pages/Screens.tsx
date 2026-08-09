/**
 * The screens that are still the old dialogs rendered as a page.
 *
 * Hosts, nodes and settings have proper pages of their own now; what's left
 * here are the two read-only reports. <PageMode> strips their dialog chrome
 * (see components/PageOrModal), and the store-driven one is switched on while
 * its route is mounted so its data loads exactly as it did from the old menu.
 */
import { AuditLogModal } from "components/AuditLogModal";
import { NodesUsage } from "components/NodesUsage";
import { PageMode } from "components/PageOrModal";
import { useDashboard } from "contexts/DashboardContext";
import { FC, useEffect } from "react";
import { useNavigate } from "react-router-dom";

export const NodesUsagePage: FC = () => {
  const { onShowingNodesUsage } = useDashboard();
  useEffect(() => {
    onShowingNodesUsage(true);
    return () => onShowingNodesUsage(false);
  }, []);
  return (
    <PageMode>
      <NodesUsage />
    </PageMode>
  );
};

export const AuditLogPage: FC = () => {
  const navigate = useNavigate();
  return (
    <PageMode>
      <AuditLogModal isOpen onClose={() => navigate("/")} />
    </PageMode>
  );
};

import { lazy, Suspense, useEffect } from "react";
import { Spinner } from "@/components/ui/spinner";
import { useTranslation } from "react-i18next";
import { router } from "@/pages/router";
import { Footer } from "@/components/footer";
import { Header } from "@/components/dashboard/header";
import { Statistics } from "@/components/dashboard/statistics";
import { Filters } from "@/components/dashboard/filters";
import { UsersTable } from "@/components/dashboard/table/users-table";
import { cancelUsersRequest, fetchInbounds, FilterType, useDashboard } from "@/contexts/dashboard-context";

const UserDialog = lazy(() =>
  import("@/components/dashboard/user-dialog").then((module) => ({ default: module.UserDialog })),
);
const DeleteUserModal = lazy(() =>
  import("@/components/dashboard/delete-user-modal").then((module) => ({ default: module.DeleteUserModal })),
);
const QRCodeDialog = lazy(() =>
  import("@/components/dashboard/qr-code-dialog").then((module) => ({ default: module.QRCodeDialog })),
);
const HostsDialog = lazy(() =>
  import("@/components/dashboard/hosts-dialog").then((module) => ({ default: module.HostsDialog })),
);
const NodesDialog = lazy(() =>
  import("@/components/dashboard/nodes-modal").then((module) => ({ default: module.NodesDialog })),
);
const NodesUsage = lazy(() =>
  import("@/components/dashboard/nodes-usage").then((module) => ({ default: module.NodesUsage })),
);
const ResetUserUsageModal = lazy(() =>
  import("@/components/dashboard/reset-user-usage-modal").then((module) => ({ default: module.ResetUserUsageModal })),
);
const RevokeSubscriptionModal = lazy(() =>
  import("@/components/dashboard/revoke-subscription-modal").then((module) => ({
    default: module.RevokeSubscriptionModal,
  })),
);
const ResetAllUsageModal = lazy(() =>
  import("@/components/dashboard/reset-all-usage-modal").then((module) => ({ default: module.ResetAllUsageModal })),
);
const CoreSettingsModal = lazy(() =>
  import("@/components/dashboard/core-settings-modal").then((module) => ({ default: module.CoreSettingsModal })),
);

function restoreFilters(search: string) {
  const params = new URLSearchParams(search);
  const offset = Number(params.get("offset"));
  const filters: Partial<FilterType> = {
    search: params.get("search") || undefined,
    status: (params.get("status") as FilterType["status"]) || undefined,
    sort: params.get("sort") || "-created_at",
    offset: params.has("offset") && Number.isFinite(offset) && offset >= 0 ? offset : undefined,
  };
  useDashboard.getState().onFilterChange(filters, false);
}

export function Dashboard() {
  const { t } = useTranslation();
  const showDeleteUser = useDashboard((state) => !!state.deletingUser);
  const isShowingNodesUsage = useDashboard((state) => state.isShowingNodesUsage);
  const showQRCode = useDashboard((state) => state.QRcodeLinks !== null);
  const showResetUsage = useDashboard((state) => !!state.resetUsageUser);
  const showRevokeSubscription = useDashboard((state) => !!state.revokeSubscriptionUser);
  const isResetingAllUsage = useDashboard((state) => state.isResetingAllUsage);

  useEffect(() => {
    restoreFilters(router.state.location.search);
    const controller = new AbortController();
    fetchInbounds(controller.signal).catch(() => {
      // Inbound settings can be retried by opening/saving the core configuration.
    });
    // One subscription per mount, with no delayed callbacks left after unmount.
    let previousSearch = router.state.location.search;
    const unsubscribe = router.subscribe((state) => {
      if (state.location.search === previousSearch) return;
      previousSearch = state.location.search;
      if (state.historyAction === "POP") restoreFilters(previousSearch);
    });
    return () => {
      unsubscribe();
      controller.abort();
      cancelUsersRequest();
    };
  }, []);

  return (
    <div className="flex min-h-screen w-full flex-col justify-between gap-4 bg-background p-3 text-foreground lg:p-6">
      <main className="w-full">
        <Header />
        <Statistics />
        <Filters />
        <UsersTable />
      </main>
      <Suspense fallback={<div role="status" aria-label={t("loading", { defaultValue: "Loading…" })}
        className="fixed inset-0 z-50 flex items-center justify-center bg-black/10 backdrop-blur-xs"><Spinner className="size-6" /></div>}>
        {showDeleteUser && <DeleteUserModal />}
        {showQRCode && <QRCodeDialog />}
        {showResetUsage && <ResetUserUsageModal />}
        {showRevokeSubscription && <RevokeSubscriptionModal />}
        {isShowingNodesUsage && <NodesUsage />}
        {isResetingAllUsage && <ResetAllUsageModal />}
      </Suspense>
      {/* Keep the sheet mounted so Base UI can animate its open and closed states. */}
      <Suspense fallback={null}>
        <CoreSettingsModal />
        <UserDialog />
        <NodesDialog />
        <HostsDialog />
      </Suspense>
      <Footer />
    </div>
  );
}

export default Dashboard;

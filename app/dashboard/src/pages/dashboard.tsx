import { preloadTrafficChart } from "@/features/shared/dialog-preload";
import { UserDialog as UserDialogContent } from "@/components/dashboard/user-dialog";
import { DeleteUserModal as DeleteUserModalContent } from "@/components/dashboard/delete-user-modal";
import { QRCodeDialog as QRCodeDialogContent } from "@/components/dashboard/qr-code-dialog";
import { HostsDialog as HostsDialogContent } from "@/components/dashboard/hosts-dialog";
import { NodesDialog as NodesDialogContent } from "@/components/dashboard/nodes-modal";
import { NodesUsage as NodesUsageContent } from "@/components/dashboard/nodes-usage";
import { ResetUserUsageModal as ResetUserUsageModalContent } from "@/components/dashboard/reset-user-usage-modal";
import { RevokeSubscriptionModal as RevokeSubscriptionModalContent } from "@/components/dashboard/revoke-subscription-modal";
import { ResetAllUsageModal as ResetAllUsageModalContent } from "@/components/dashboard/reset-all-usage-modal";
import { CoreSettingsModal as CoreSettingsModalContent } from "@/components/dashboard/core-settings-modal";
import { QueryFeedback } from "@/components/dashboard/query-feedback";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { useInbounds } from "@/features/users/use-inbounds";
import { createImmediateDialog } from "@/components/dashboard/deferred-dialog";
import { router } from "@/pages/router";
import { Footer } from "@/components/footer";
import { Header } from "@/components/dashboard/header";
import { Statistics } from "@/components/dashboard/statistics";
import { Filters } from "@/components/dashboard/filters";
import { UsersTable } from "@/components/dashboard/table/users-table";
import { cancelUsersRequest, FilterType, useDashboard } from "@/contexts/dashboard-context";

const UserDialog = createImmediateDialog(UserDialogContent);
const DeleteUserModal = createImmediateDialog(DeleteUserModalContent);
const QRCodeDialog = createImmediateDialog(QRCodeDialogContent);
const HostsDialog = createImmediateDialog(HostsDialogContent);
const NodesDialog = createImmediateDialog(NodesDialogContent);
const NodesUsage = createImmediateDialog(NodesUsageContent);
const ResetUserUsageModal = createImmediateDialog(ResetUserUsageModalContent);
const RevokeSubscriptionModal = createImmediateDialog(RevokeSubscriptionModalContent);
const ResetAllUsageModal = createImmediateDialog(ResetAllUsageModalContent);
const CoreSettingsModal = createImmediateDialog(CoreSettingsModalContent);

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
  const [filtersReady, setFiltersReady] = useState(false);
  const { t } = useTranslation();
  const inbounds = useInbounds();
  const showUser = useDashboard((state) => state.isCreatingNewUser || !!state.editingUser);
  const showCore = useDashboard((state) => state.isEditingCore);
  const showNodes = useDashboard((state) => state.isEditingNodes);
  const showHosts = useDashboard((state) => state.isEditingHosts);
  const showDeleteUser = useDashboard((state) => !!state.deletingUser);
  const isShowingNodesUsage = useDashboard((state) => state.isShowingNodesUsage);
  const showQRCode = useDashboard((state) => state.QRcodeLinks !== null);
  const showResetUsage = useDashboard((state) => !!state.resetUsageUser);
  const showRevokeSubscription = useDashboard((state) => !!state.revokeSubscriptionUser);
  const isResetingAllUsage = useDashboard((state) => state.isResetingAllUsage);

  useEffect(() => {
    // Warm the shared chart after initial dashboard work; cancel if navigation occurs first.
    const warmup = window.setTimeout(() => { void preloadTrafficChart(); }, 2000);
    return () => window.clearTimeout(warmup);
  }, []);

  useEffect(() => {
    restoreFilters(router.state.location.search);
    setFiltersReady(true);
    // One subscription per mount, with no delayed callbacks left after unmount.
    let previousSearch = router.state.location.search;
    const unsubscribe = router.subscribe((state) => {
      if (state.location.search === previousSearch) return;
      previousSearch = state.location.search;
      if (state.historyAction === "POP") restoreFilters(previousSearch);
    });
    return () => {
      unsubscribe();
      cancelUsersRequest();
    };
  }, []);

  return (
    <div className="flex min-h-screen w-full flex-col justify-between gap-4 bg-background p-3 text-foreground lg:p-6">
      <main className="w-full">
        <Header />
        <Statistics />
        {inbounds.failed && <Alert variant="destructive">
          <AlertDescription className="flex flex-wrap items-center justify-between gap-3">
            <span>{t("inboundsLoadError", { defaultValue: "Could not load connection protocols. Retry before creating a user." })}</span>
            <Button variant="outline" disabled={inbounds.loading} onClick={() => void inbounds.retry()}>{t("retry", { defaultValue: "Retry" })}</Button>
          </AlertDescription>
        </Alert>}
        {filtersReady ? <><Filters /><UsersTable /></> : <QueryFeedback loading refreshing={false} failed={false} />}
      </main>
      <DeleteUserModal open={showDeleteUser} onClose={() => useDashboard.setState({ deletingUser: null })} />
      <QRCodeDialog open={showQRCode} onClose={() => useDashboard.setState({ QRcodeLinks: null, subscribeUrl: null })} />
      <ResetUserUsageModal open={showResetUsage} onClose={() => useDashboard.setState({ resetUsageUser: null })} />
      <RevokeSubscriptionModal open={showRevokeSubscription} onClose={() => useDashboard.setState({ revokeSubscriptionUser: null })} />
      <NodesUsage open={isShowingNodesUsage} onClose={() => useDashboard.setState({ isShowingNodesUsage: false })} />
      <ResetAllUsageModal open={isResetingAllUsage} onClose={() => useDashboard.setState({ isResetingAllUsage: false })} />
      <CoreSettingsModal open={showCore} onClose={() => useDashboard.setState({ isEditingCore: false })} />
      <UserDialog open={showUser} onClose={() => useDashboard.setState({ isCreatingNewUser: false, editingUser: null })} />
      <NodesDialog open={showNodes} onClose={() => useDashboard.setState({ isEditingNodes: false })} />
      <HostsDialog open={showHosts} onClose={() => useDashboard.setState({ isEditingHosts: false })} />
      <Footer />
    </div>
  );
}

export default Dashboard;

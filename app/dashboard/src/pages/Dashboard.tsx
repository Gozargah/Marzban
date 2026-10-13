// import { CoreSettingsModal } from "components/CoreSettingsModal";
// import { DeleteUserModal } from "components/DeleteUserModal";
// import { Filters } from "components/Filters";
// import { HostsDialog } from "components/HostsDialog";
// import { NodesDialog } from "components/NodesModal";
// import { NodesUsage } from "components/NodesUsage";
// import { QRCodeDialog } from "components/QRCodeDialog";
// import { ResetAllUsageModal } from "components/ResetAllUsageModal";
// import { ResetUserUsageModal } from "components/ResetUserUsageModal";
// import { RevokeSubscriptionModal } from "components/RevokeSubscriptionModal";
// import { UserDialog } from "components/UserDialog";
// import { UsersTable } from "components/UsersTable";
import { Footer } from "@/components/footer";
import { Header } from "@/components/dashboard/header";
import { fetchInbounds, FilterType, useDashboard } from "contexts/DashboardContext";
import { FC, useEffect } from "react";
// import { Statistics } from "../components/Statistics";
import debounce from "lodash.debounce";
import { router } from "@/pages/router";
import { Statistics } from "@/components/dashboard/statistics";
import { Filters } from "@/components/dashboard/filters";
import { UsersTable } from "@/components/dashboard/table/users-table";


export const Dashboard: FC = () => {
  useEffect(() => {
    useDashboard.getState().refetchUsers();
    fetchInbounds();
  }, []);

  useEffect(() => {
    setTimeout(function () {
      const initFilters = debounce((params: URLSearchParams) => {
        const filters: Partial<FilterType> = {};

        filters.search = params.get("search") || undefined;
        filters.status = (params.get("status") as FilterType["status"]) || undefined;
        filters.sort = params.get("sort") || "-created_at";
        filters.offset = params.get("offset") ? Number(params.get("offset")) : undefined;

        useDashboard.getState().onFilterChange(filters, false);
      }, 50);

      initFilters(new URLSearchParams(router.state.location.search));
      router.subscribe(
        debounce((state) => {
          if (state.historyAction === "POP") {
            const params = new URLSearchParams(state.location.search);
            initFilters(params);
          }
        }, 50),
      );
    }, 50);
  });
  return (
    <div className="flex min-h-screen w-full flex-col items-center justify-between gap-4 bg-background p-3 text-foreground lg:p-6">
      <div className="w-full">
        <Header />
        <Statistics />
        <Filters />
        <UsersTable />
        {/* <Statistics mt="4" />

        <UserDialog />
        <DeleteUserModal />
        <QRCodeDialog />
        <HostsDialog />
        <ResetUserUsageModal />
        <RevokeSubscriptionModal />
        <NodesDialog />
        <NodesUsage />
        <ResetAllUsageModal />
        <CoreSettingsModal /> */}
      </div>
      <Footer />
    </div>
  );
};

export default Dashboard;

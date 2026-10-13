import { Box, VStack } from "@chakra-ui/react";
import { CoreSettingsModal } from "components/CoreSettingsModal";
import { DeleteUserModal } from "components/DeleteUserModal";
import { Filters } from "components/Filters";
import { Footer } from "@/components/footer";
import { Header } from "components/Header";
import { HostsDialog } from "components/HostsDialog";
import { NodesDialog } from "components/NodesModal";
import { NodesUsage } from "components/NodesUsage";
import { QRCodeDialog } from "components/QRCodeDialog";
import { ResetAllUsageModal } from "components/ResetAllUsageModal";
import { ResetUserUsageModal } from "components/ResetUserUsageModal";
import { RevokeSubscriptionModal } from "components/RevokeSubscriptionModal";
import { UserDialog } from "components/UserDialog";
import { UsersTable } from "components/UsersTable";
import { fetchInbounds, FilterType, useDashboard } from "contexts/DashboardContext";
import { FC, useEffect } from "react";
import { Statistics } from "../components/Statistics";
import debounce from "lodash.debounce";
import { router } from "@/pages/router";

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
    <VStack
      justifyContent="space-between"
      minH="100vh"
      p={{
        base: "3",
        lg: "6",
      }}
      rowGap={4}
    >
      <Box w="full">
        <Header />
        <Statistics mt="4" />
        <Filters />
        <UsersTable />
        <UserDialog />
        <DeleteUserModal />
        <QRCodeDialog />
        <HostsDialog />
        <ResetUserUsageModal />
        <RevokeSubscriptionModal />
        <NodesDialog />
        <NodesUsage />
        <ResetAllUsageModal />
        <CoreSettingsModal />
      </Box>
      <Footer />
    </VStack>
  );
};

export default Dashboard;

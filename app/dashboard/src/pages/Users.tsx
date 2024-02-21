import { Box, VStack } from "@chakra-ui/react";
import { CoreSettingsModal } from "components/common/settings/CoreSettingsModal";
import { DeleteUserModal } from "components/common/user/DeleteUserModal";
import { Filters } from "components/common/user/Filters";
import { Footer } from "components/layouts/Footer";
import { Header } from "components/layouts/Header";
import { HostsDialog } from "components/common/settings/HostsDialog";
import { NodesUsage } from "components/common/nodes/NodesUsage";
import { QRCodeDialog } from "components/common/user/QRCodeDialog";
import { ResetAllUsageModal } from "components/common/settings/ResetAllUsageModal";
import { ResetUserUsageModal } from "components/common/user/ResetUserUsageModal";
import { RevokeSubscriptionModal } from "components/common/user/RevokeSubscriptionModal";
import { Statistics } from "components/common/statistics/Statistics";
import { UserDialog } from "components/common/user/UserDialog";
import { UsersTable } from "components/common/user/UsersTable";
import { NodesDialog } from "components/nodes";
import { FC } from "react";

export const Dashboard: FC = () => {
  return (
    <VStack justifyContent="space-between" minH="full" rowGap={4}>
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

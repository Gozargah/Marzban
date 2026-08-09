import { Box, Text, VStack } from "@chakra-ui/react";
import { UsersIcon } from "@heroicons/react/24/outline";
import { DeleteUserModal } from "components/DeleteUserModal";
import { DeviceStats } from "components/DeviceStats";
import { Filters } from "components/Filters";
import { QRCodeDialog } from "components/QRCodeDialog";
import { ResetUserUsageModal } from "components/ResetUserUsageModal";
import { RevokeSubscriptionModal } from "components/RevokeSubscriptionModal";
import { UserDialog } from "components/UserDialog";
import { UsersTable } from "components/UsersTable";
import { PageHeader } from "components/ui";
import { fetchInbounds, useDashboard } from "contexts/DashboardContext";
import { FC, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { Statistics } from "../components/Statistics";

/** The users screen: system stats on top, then the user list. Everything that
 *  used to sit behind the burger menu has a route of its own now (Router.tsx);
 *  the sidebar, header and footer live in components/Layout. */
export const Dashboard: FC = () => {
  const { t } = useTranslation();

  useEffect(() => {
    useDashboard.getState().refetchUsers();
    fetchInbounds();
  }, []);

  return (
    <Box w="full">
      <PageHeader title={t("users")} icon={UsersIcon} />

      <VStack align="stretch" spacing="6">
        <Statistics />

        <Box>
          <Text textStyle="sectionTitle" mb="3">
            {t("deviceStats.title")}
          </Text>
          <DeviceStats />
        </Box>

        <Box>
          <Filters />
          <UsersTable />
        </Box>
      </VStack>

      <UserDialog />
      <DeleteUserModal />
      <QRCodeDialog />
      <ResetUserUsageModal />
      <RevokeSubscriptionModal />
    </Box>
  );
};

export default Dashboard;

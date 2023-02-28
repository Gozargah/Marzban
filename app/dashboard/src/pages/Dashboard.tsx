import { Box, Button, VStack } from "@chakra-ui/react";
import { Statistics } from "../components/Statistics";
import { FC, useEffect } from "react";
import { Footer } from "components/Footer";
import { Header } from "components/Header";
import { UsersTable } from "components/UsersTable";
import { Filters } from "components/Filters";
import { useDashboard } from "contexts/DashboardContext";
import { UserDialog } from "components/UserDialog";
import { DeleteUserModal } from "components/DeleteUserModal";
import { QRCodeDialog } from "components/QRCodeDialog";
import { HostsDialog } from "components/HostsDialog";

export const Dashboard: FC = () => {
  useEffect(useDashboard.getState().refetchUsers, []);
  return (
    <VStack justifyContent="space-between" minH="100vh" p="6" rowGap={4}>
      <Box w="full">
        <Header />
        <Statistics mt="4" />
        <Filters />
        <UsersTable />
        <UserDialog />
        <DeleteUserModal />
        <QRCodeDialog />
        <HostsDialog />
      </Box>
      <Footer />
    </VStack>
  );
};

export default Dashboard;

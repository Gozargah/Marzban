import { Box, VStack } from "@chakra-ui/react";
import { DeleteUserModal } from "components/common/user/DeleteUserModal";
import { Filters } from "components/common/user/Filters";
import { Footer } from "components/layouts/Footer";
import { Header } from "components/layouts/Header";
import { QRCodeDialog } from "components/common/user/QRCodeDialog";
import { ResetUserUsageModal } from "components/common/user/ResetUserUsageModal";
import { RevokeSubscriptionModal } from "components/common/user/RevokeSubscriptionModal";
import { UserDialog } from "components/common/user/UserDialog";
import { UsersTable } from "components/common/user/UsersTable";
import { FC } from "react";
import { UserStatistics } from "@/components/common/statistics/UserStatistics";

export const Users: FC = () => {
  return (
    <VStack justifyContent="space-between" minH="full" rowGap={4}>
      <Box w="full">
        <Header pageName="users" />
        <UserStatistics mt="4" />
        <Filters />
        <UsersTable />
        <UserDialog />
        <DeleteUserModal />
        <QRCodeDialog />
        <ResetUserUsageModal />
        <RevokeSubscriptionModal />
      </Box>
      <Footer />
    </VStack>
  );
};

export default Users;

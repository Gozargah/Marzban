import { Box, Button, VStack } from "@chakra-ui/react";
import { UserStatistics } from "components/common/statistics/UserStatistics";
import { DeleteUserModal } from "components/common/user/DeleteUserModal";
import { Filters } from "components/common/user/Filters";
import { QRCodeDialog } from "components/common/user/QRCodeDialog";
import { ResetUserUsageModal } from "components/common/user/ResetUserUsageModal";
import { RevokeSubscriptionModal } from "components/common/user/RevokeSubscriptionModal";
import { UserDialog } from "components/common/user/UserDialog";
import { UsersTable } from "components/common/user/UsersTable";
import { Footer } from "components/layouts/Footer";
import { Header } from "components/layouts/Header";
import { useDashboard } from "contexts/DashboardContext";
import { FC } from "react";
import { useTranslation } from "react-i18next";

export const Users: FC = () => {
  const { onCreateUser } = useDashboard();
  const { t } = useTranslation();
  return (
    <VStack justifyContent="space-between" minH="full" rowGap={4}>
      <Box w="full">
        <Header
          pageName="users"
          actions={
            <>
              <Button
                display={{
                  base: "none",
                  md: "flex",
                }}
                size="sm"
                colorScheme="primary"
                onClick={() => onCreateUser(true)}
              >
                {t("createUser")}
              </Button>
            </>
          }
        />
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

import { Box, Button, VStack } from "@chakra-ui/react";
import { Statistics } from "../components/Statistics";
import { FC } from "react";
import { Footer } from "../components/Footer";
import { Header } from "../components/Header";
import { UsersTable } from "../components/UsersTable";
import { Filters } from "../components/Filters";
import { useDashboard } from "../contexts/DashboardContext";
import { UserDialog } from "../components/UserDialog";
import { DeleteUserModal } from "../components/DeleteUserModal";
import { QRCodeDialog } from "../components/QRCodeDialog";

export const Dashboard: FC = () => {
  const { onCreateUser } = useDashboard();
  return (
    <VStack
      justifyContent="space-between"
      minH="100vh"
      p="6"
      experimental_spaceY={4}
    >
      <Box w="full">
        <Header
          actions={
            <Button
              colorScheme="primary"
              size="sm"
              onClick={() => onCreateUser(true)}
            >
              Create user
            </Button>
          }
        />
        <Statistics mt="4" />
        <Filters mt="4" />
        <UsersTable mt="4" />
        <UserDialog />
        <DeleteUserModal />
        <QRCodeDialog />
      </Box>
      <Footer />
    </VStack>
  );
};

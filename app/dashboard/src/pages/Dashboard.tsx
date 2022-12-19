import { Box, VStack } from "@chakra-ui/react";
import { FC } from "react";
import { Footer } from "../components/Footer";
import { Header } from "../components/Header";
import { UserTable } from "../components/modules/UsersTable";

export const Dashboard: FC = () => {
  return (
    <VStack justifyContent="space-between" minH="100vh" w="full">
      <Box w="full">
        <Header />
        <UserTable />
      </Box>
      <Footer />
    </VStack>
  );
};

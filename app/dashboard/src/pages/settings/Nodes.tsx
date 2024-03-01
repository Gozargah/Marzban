import { Box, VStack } from "@chakra-ui/react";
import { Footer } from "components/layouts/Footer";
import { Header } from "components/layouts/Header";
import { FC } from "react";

export const NodeSettings: FC = () => {
  return (
    <VStack justifyContent="space-between" minH="full" rowGap={4}>
      <Box w="full">
        <Header pageName="settings.node" />
      </Box>
      <Footer />
    </VStack>
  );
};

export default NodeSettings;

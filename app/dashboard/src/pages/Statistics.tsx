import { Box, VStack } from "@chakra-ui/react";
import { Footer } from "@/components/layouts/Footer";
import { Header } from "@/components/layouts/Header";
import { StatisticCard } from "@/components/common/statistics/StatisticCard";
import { FC } from "react";

const Statistics: FC = () => {
  return (
    <VStack justifyContent="space-between" minH="full" rowGap={4}>
      <Box w="full">
        <Header pageName="statistics" />
      </Box>
      <Footer />
    </VStack>
  );
};

export { Statistics };

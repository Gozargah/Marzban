import {
  Box,
  CircularProgress,
  HStack,
  Modal,
  ModalBody,
  ModalCloseButton,
  ModalContent,
  ModalFooter,
  ModalHeader,
  ModalOverlay,
  Text,
  VStack,
  chakra,
  useColorMode,
} from "@chakra-ui/react";
import { ChartPieIcon } from "@heroicons/react/24/outline";
import { FilterUsageType, useDashboard } from "contexts/DashboardContext";
import dayjs from "dayjs";
import { FC, Suspense, useEffect, useState } from "react";
import ReactApexChart from "react-apexcharts";
import { useTranslation } from "react-i18next";
import { useGetNodesUsage } from "core/services/api";
import { Icon } from "components/tools/Icon";
import { UsageFilter, createUsageConfig } from "./UsageFilter";

const UsageIcon = chakra(ChartPieIcon, {
  baseStyle: {
    w: 5,
    h: 5,
  },
});

export type NodesUsageProps = {};

export const NodesUsage: FC<NodesUsageProps> = () => {
  const { isShowingNodesUsage, onShowingNodesUsage } = useDashboard();
  const [filter, setFilters] = useState<FilterUsageType>();
  const { isLoading } = useGetNodesUsage(filter, {
    query: {
      onSuccess(data) {
        const labels = [];
        const series = [];
        for (const key in data.usages) {
          const entry = data.usages[key];
          series.push(entry.uplink + entry.downlink);
          labels.push(entry.node_name);
        }
        setUsage(createUsageConfig(colorMode, usageTitle, series, labels));
      },
    },
  });
  const { t } = useTranslation();
  const { colorMode } = useColorMode();
  const usageTitle = t("userDialog.total");
  const [usage, setUsage] = useState(createUsageConfig(colorMode, usageTitle));
  const [usageFilter, setUsageFilter] = useState("1m");

  useEffect(() => {
    if (isShowingNodesUsage) {
      setFilters({
        start: dayjs().utc().subtract(30, "day").format("YYYY-MM-DDTHH:00:00"),
      });
    }
  }, [isShowingNodesUsage]);

  const onClose = () => {
    onShowingNodesUsage(false);
    setUsageFilter("1m");
  };

  const disabled = isLoading;

  return (
    <Modal isOpen={isShowingNodesUsage} onClose={onClose} size="2xl">
      <ModalOverlay bg="blackAlpha.300" backdropFilter="blur(10px)" />
      <ModalContent mx="3" w="full">
        <ModalHeader pt={6}>
          <HStack gap={2}>
            <Icon color="primary">
              <UsageIcon color="white" />
            </Icon>
            <Text fontWeight="semibold" fontSize="lg">
              {t("header.nodesUsage")}
            </Text>
          </HStack>
        </ModalHeader>
        <ModalCloseButton mt={3} disabled={disabled} />
        <ModalBody>
          <VStack gap={4}>
            <UsageFilter
              defaultValue={usageFilter}
              onChange={(filter, query) => {
                setUsageFilter(filter);
                setFilters(query);
              }}
            />
            <Box justifySelf="center" w="full" maxW="300px" mt="4">
              <Suspense fallback={<CircularProgress isIndeterminate />}>
                <ReactApexChart options={usage.options} series={usage.series} type="donut" height="500px" />
              </Suspense>
            </Box>
          </VStack>
        </ModalBody>
        <ModalFooter mt="3"></ModalFooter>
      </ModalContent>
    </Modal>
  );
};

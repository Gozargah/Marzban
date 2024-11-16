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
import { useNodes } from "contexts/NodesContext";
import dayjs from "dayjs";
import { FC, Suspense, useEffect, useState } from "react";
import ReactApexChart from "react-apexcharts";
import { useTranslation } from "react-i18next";
import { Icon } from "./Icon";
import {
  UsageFilter,
  createTop10UsageConfig,
  createUsageConfig,
} from "./UsageFilter";

const UsageIcon = chakra(ChartPieIcon, {
  baseStyle: {
    w: 5,
    h: 5,
  },
});

export type NodesUsageProps = {};

export const NodesUsage: FC<NodesUsageProps> = () => {
  const { isShowingNodesUsage, onShowingNodesUsage, fetchUserUsageTop10 } = useDashboard();
  const { fetchNodesUsage } = useNodes();
  const { t } = useTranslation();
  const [loading, setLoading] = useState(false);
  const { colorMode } = useColorMode();

  const usageTitle = t("userDialog.total");
  const [usage, setUsage] = useState(createUsageConfig(colorMode, usageTitle));
  const [top10Usage, setTop10Usage] = useState(
    createTop10UsageConfig(colorMode)
  );
  const [usageFilter, setUsageFilter] = useState("1m");
  const fetchUsageWithFilter = (query: FilterUsageType) => {
    fetchNodesUsage(query).then((data: any) => {
      const labels = [];
      const series = [];
      for (const key in data.usages) {
        const entry = data.usages[key];
        series.push(entry.uplink + entry.downlink);
        labels.push(entry.node_name);
      }
      setUsage(createUsageConfig(colorMode, usageTitle, series, labels));
    });
    fetchUserUsageTop10(query).then((data: any) => {
      const top10Series = data.usages;
      const top10Users = data.users;
      setTop10Usage(createTop10UsageConfig(colorMode, top10Series, top10Users));
    })
  };

  useEffect(() => {
    if (isShowingNodesUsage) {
      fetchUsageWithFilter({
        start: dayjs().utc().subtract(30, "day").format("YYYY-MM-DDTHH:00:00"),
      });
    }
  }, [isShowingNodesUsage]);

  const onClose = () => {
    onShowingNodesUsage(false);
    setUsageFilter("1m");
  };

  const disabled = loading;

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
                fetchUsageWithFilter(query);
              }}
            />
            <Box justifySelf="center" w="full" mt="4">
              <Suspense fallback={<CircularProgress isIndeterminate />}>
                <ReactApexChart
                  options={usage.options}
                  series={usage.series}
                  type="donut"
                  height="360px"
                />
              </Suspense>
            </Box>
            <Box justifySelf="center" w="full">
              <Suspense fallback={<CircularProgress isIndeterminate />}>
                <ReactApexChart
                  options={top10Usage.options}
                  series={top10Usage.series}
                  type="bar"
                />
              </Suspense>
            </Box>
          </VStack>
        </ModalBody>
        <ModalFooter mt="3"></ModalFooter>
      </ModalContent>
    </Modal>
  );
};

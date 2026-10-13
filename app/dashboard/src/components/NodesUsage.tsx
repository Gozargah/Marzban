import {
  Box,
  CircularProgress,
  HStack,
  Link,
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
  ColorMode,
  useColorMode,
} from "@chakra-ui/react";
import { ChartPieIcon } from "@heroicons/react/24/outline";
import { ApexOptions } from "apexcharts";
import { FilterUsageType, useDashboard } from "contexts/DashboardContext";
import { useNodes } from "contexts/NodesContext";
import dayjs from "dayjs";
import { FC, Suspense, useEffect, useMemo, useState } from "react";
import ReactApexChart from "react-apexcharts";
import { Trans, useTranslation } from "react-i18next";
import { formatBytes } from "utils/formatByte";
import { Icon } from "./Icon";
import { UsageFilter } from "./UsageFilter";

const UsageIcon = chakra(ChartPieIcon, {
  baseStyle: {
    w: 5,
    h: 5,
  },
});

const GRAFANA_HOSTING_NODES_DASHBOARD_PATH = "/grafana/d/hosting-nodes-limits";

/** formatBytes без asArray; явный string для Apex formatters (tsc). */
function formatTrafficBytes(bytes: number, decimals = 2): string {
  return formatBytes(bytes, decimals) as string;
}

function createNodesUsageBarConfig(
  colorMode: ColorMode,
  data: number[],
  categories: string[]
): { series: ApexOptions["series"]; options: ApexOptions } {
  const labelColor =
    colorMode === "dark" ? "var(--chakra-colors-gray-300)" : undefined;

  return {
    series: [{ name: "traffic", data }],
    options: {
      chart: {
        type: "bar",
        toolbar: { show: false },
        animations: { enabled: false },
      },
      plotOptions: {
        bar: {
          borderRadius: 4,
          columnWidth: "55%",
        },
      },
      xaxis: {
        categories,
        labels: {
          rotate: -45,
          rotateAlways: categories.length > 4,
          trim: true,
          hideOverlappingLabels: true,
          style: { colors: labelColor, fontSize: "11px" },
        },
      },
      yaxis: {
        labels: {
          formatter: (val: number) => formatTrafficBytes(val, 1),
          style: { colors: labelColor },
        },
      },
      tooltip: {
        y: {
          formatter: (val: number) => formatTrafficBytes(val, 2),
        },
      },
      dataLabels: { enabled: false },
      colors: ["var(--chakra-colors-primary-500)"],
      grid: {
        borderColor:
          colorMode === "dark"
            ? "var(--chakra-colors-whiteAlpha-200)"
            : "var(--chakra-colors-blackAlpha-100)",
      },
    },
  };
}

export type NodesUsageProps = {};

export const NodesUsage: FC<NodesUsageProps> = () => {
  const { isShowingNodesUsage, onShowingNodesUsage } = useDashboard();
  const { fetchNodesUsage } = useNodes();
  const { t } = useTranslation();
  const [loading, setLoading] = useState(false);
  const { colorMode } = useColorMode();

  const [usageFilter, setUsageFilter] = useState("1m");
  const [trafficSource, setTrafficSource] = useState<"nic" | "panel">("panel");
  const [barSeries, setBarSeries] = useState<number[]>([]);
  const [barCategories, setBarCategories] = useState<string[]>([]);
  const [totalBytes, setTotalBytes] = useState(0);

  const grafanaDashboardUrl = useMemo(() => {
    if (typeof window === "undefined") {
      return GRAFANA_HOSTING_NODES_DASHBOARD_PATH;
    }
    return `${window.location.origin}${GRAFANA_HOSTING_NODES_DASHBOARD_PATH}`;
  }, [isShowingNodesUsage]);

  const barChart = useMemo(
    () => createNodesUsageBarConfig(colorMode, barSeries, barCategories),
    [colorMode, barSeries, barCategories]
  );

  const chartHeight = Math.min(Math.max(280, barCategories.length * 28), 480);

  const fetchUsageWithFilter = (query: FilterUsageType) => {
    fetchNodesUsage(query).then((data: any) => {
      const labels: string[] = [];
      const series: number[] = [];
      let total = 0;
      for (const key in data.usages) {
        const entry = data.usages[key];
        const bytes = entry.uplink + entry.downlink;
        series.push(bytes);
        labels.push(entry.node_name);
        total += bytes;
      }
      setBarSeries(series);
      setBarCategories(labels);
      setTotalBytes(total);
      setTrafficSource(data.traffic_source === "nic" ? "nic" : "panel");
    });
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

  const grafanaLink = (
    <Link
      href={grafanaDashboardUrl}
      isExternal
      color="blue.500"
      textDecoration="underline"
      _hover={{ color: "blue.600" }}
    />
  );

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
          <Text fontSize="sm" color="gray.500" fontWeight="normal" mt={1}>
            {trafficSource === "nic" ? (
              <Trans
                i18nKey="header.nodesUsageHint"
                components={{ grafana: grafanaLink }}
              />
            ) : (
              t("header.nodesUsageHintPanel")
            )}
          </Text>
        </ModalHeader>
        <ModalCloseButton mt={3} disabled={disabled} />
        <ModalBody>
          <VStack gap={4} align="stretch">
            <UsageFilter
              defaultValue={usageFilter}
              onChange={(filter, query) => {
                setUsageFilter(filter);
                fetchUsageWithFilter(query);
              }}
            />
            <Box w="full" mt="2">
              <Suspense fallback={<CircularProgress isIndeterminate />}>
                <ReactApexChart
                  options={barChart.options}
                  series={barChart.series}
                  type="bar"
                  height={chartHeight}
                />
              </Suspense>
              <Text
                fontSize="sm"
                fontWeight="medium"
                textAlign="center"
                mt={3}
                color={colorMode === "dark" ? "gray.300" : "gray.700"}
              >
                {t("header.nodesUsageTotal", {
                  value: formatTrafficBytes(totalBytes),
                })}
              </Text>
            </Box>
          </VStack>
        </ModalBody>
        <ModalFooter mt="3"></ModalFooter>
      </ModalContent>
    </Modal>
  );
};

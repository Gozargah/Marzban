import {
  chakra,
  HStack,
  Modal,
  ModalBody,
  ModalCloseButton,
  ModalContent,
  ModalFooter,
  ModalHeader,
  ModalOverlay,
  Text,
  Box,
  useColorMode,
  ColorMode,
  VStack,
  SimpleGrid,
  Grid,
  GridItem,
} from "@chakra-ui/react";
import { ChartPieIcon} from "@heroicons/react/24/outline";
import { useDashboard } from "contexts/DashboardContext";
import { FC, useEffect, useState } from "react";
import { Icon } from "./Icon";
import { useTranslation } from "react-i18next";
import ReactApexChart from "react-apexcharts";
import { ApexOptions } from "apexcharts";
import { formatBytes } from "utils/formatByte"; 
import { useNodes } from "contexts/NodesContext";

const UsageIcon = chakra(ChartPieIcon, {
  baseStyle: {
    w: 5,
    h: 5,
  },
});

export type NodesUsageProps = {};

const createUsageConfig = (colorMode: ColorMode, series: any = [], labels: any = []) => {
  return {
    series: series,
    options: {
      labels: labels,
      chart: {
        type: "donut",
      },
      legend: {
        position: "bottom",
        labels: {
          colors: colorMode === "dark" ? "#CBD5E0" : undefined,
          useSeriesColors: false
        },
      },
      stroke: {
        width: 1,
        colors: undefined
      },
      tooltip: {
        custom: ({series, seriesIndex, dataPointIndex, w}) => {
          const readable = formatBytes(series[seriesIndex]);
          return `
            <div style="
                    background-color: ${w.globals.colors[seriesIndex]};
                    padding-left:12px;
                    padding-right:12px;
                    padding-top:6px;
                    padding-bottom:6px;
                    font-size:0.725rem;
                  "
            >
              ${w.config.labels[seriesIndex]}: <b>${readable}</b>
            </div>
          `
        }
      },
      responsive: [{
        breakpoint: 480,
        options: {
          chart: {
            width: 200
          },
          legend: {
            position: 'bottom'
          }
        }
      }]
    } as ApexOptions
  }
}

export const NodesUsage: FC<NodesUsageProps> = () => {
  const {
    isShowingNodesUsage,
    onShowingNodesUsage,
  } = useDashboard();
  const {
    fetchNodesUsage
  } = useNodes();
  const { t } = useTranslation();
  const [loading, setLoading] = useState(false);
  const { colorMode } = useColorMode();

  const [usageVisible, setUsageVisible] = useState(false);
  const handleUsageToggle = () => {
    setUsageVisible((current) => !current);
  };

  const [usage, setUsage] = useState(createUsageConfig(colorMode));

  useEffect(() => {
    if (isShowingNodesUsage) {
      fetchNodesUsage().then((data:any) => {
        const labels = [];
        const series = [];
        for (const key in data.usages) {
          const entry = data.usages[key];
          series.push(entry.incoming_bandwidth + entry.outgoing_bandwidth);
          labels.push(entry.node_name);
        }
        setUsage(createUsageConfig(colorMode, series, labels));
      });
    }
  }, [isShowingNodesUsage]);

  const onClose = () => {
    onShowingNodesUsage(false);
    setUsageVisible(false);
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
        <Grid templateColumns='repeat(1, 1fr)' gap={3}>
          <GridItem width={{ base: "100%", md: "70%" }} justifySelf="center">
            <ReactApexChart options={usage.options} series={usage.series} type="donut" />
          </GridItem>
        </Grid>
        </ModalBody>
        <ModalFooter mt="3">
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
};

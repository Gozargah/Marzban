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
  useRadioGroup,
} from "@chakra-ui/react";
import { ChartPieIcon} from "@heroicons/react/24/outline";
import { FilterUsageType, useDashboard } from "contexts/DashboardContext";
import { FC, useEffect, useState } from "react";
import { Icon } from "./Icon";
import { useTranslation } from "react-i18next";
import ReactApexChart from "react-apexcharts";
import { ApexOptions } from "apexcharts";
import { formatBytes } from "utils/formatByte"; 
import { useNodes } from "contexts/NodesContext";
import { FilterUsageItem } from "./UserDialog";
import dayjs, { ManipulateType } from "dayjs";
import ReactDatePicker from "react-datepicker";
import { Input } from "./Input";

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

  const [usage, setUsage] = useState(createUsageConfig(colorMode));

  const fetchUsageWithFilter = (query: FilterUsageType) => {
    fetchNodesUsage(query).then((data: any) => {
        const labels = [];
        const series = [];
        for (const key in data.usages) {
          const entry = data.usages[key];
          series.push(entry.incoming_bandwidth + entry.outgoing_bandwidth);
          labels.push(entry.node_name);
        }
        setUsage(createUsageConfig(colorMode, series, labels));
    });
  };

  useEffect(() => {
    if (isShowingNodesUsage) {
      fetchUsageWithFilter({
        start: dayjs().utc().subtract(30, 'day').format("YYYY-MM-DDTHH:00:00")
      });
    }
  }, [isShowingNodesUsage]);

  const onClose = () => {
    onShowingNodesUsage(false);
    setDefaultFilter("30d");
    setDataRangeVisible(false);
  };

  const disabled = loading;

  // filter useage
  const [filterDateRange, setFilterDateRange] = useState([null, null] as [Date | null, Date | null]);
  const [filterStartDate, filterEndDate] = filterDateRange;
  const [dataRangeVisible, setDataRangeVisible] = useState(false);
  const filterOptions = ["7h", "1d", "3d", "7d", "30d", "60d", "1y", "custom"];
  const filterOptionTypes = {h: "hour", d: "day", y: "year"};
  const { getRootProps, getRadioProps, setValue: setDefaultFilter } = useRadioGroup({
    name: "filter",
    defaultValue: "30d",
    onChange: (value: string) => {
      setDataRangeVisible(value == "custom");
      if (value === "custom" ) {
        setFilterDateRange([null, null]);
        return;
      }

      const num = Number(value.substring(0, value.length - 1));
      const unit = filterOptionTypes[value[value.length - 1] as keyof typeof filterOptionTypes];
      fetchUsageWithFilter({
        start: dayjs().utc().subtract(num, unit as ManipulateType).format("YYYY-MM-DDTHH:00:00")
      });
    },
  });

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
          <SimpleGrid gap={4} justifyItems="center">
            <HStack {...getRootProps()} gap={0}>
              {filterOptions.map((value) => {
                return (
                  <FilterUsageItem key={value} {...getRadioProps({ value })}>
                    {t("userDialog." + value)}
                  </FilterUsageItem>
                )
              })}
            </HStack>
            {dataRangeVisible && (
                <HStack>
                  <ReactDatePicker
                    // dateFormat={t("dateFormat")}
                    selectsRange={true}
                    maxDate={new Date()}
                    startDate={filterStartDate}
                    endDate={filterEndDate}
                    onChange={(update) => {
                      setFilterDateRange(update);
                      if (update[0] && update[1]) {
                        fetchUsageWithFilter({
                          start: dayjs(update[0]).format("YYYY-MM-DDT00:00:00"),
                          end: dayjs(update[1]).format("YYYY-MM-DDT23:59:59")
                        });
                      }
                    }}
                    customInput={
                      <Input
                        size="sm"
                        type="text"
                        borderRadius="6px"
                        clearable
                      />
                    }
                  />
                </HStack>
              )}
            <Box width={{ base: "100%", md: "70%" }} justifySelf="center">
              <ReactApexChart options={usage.options} series={usage.series} type="donut" />
            </Box>
          </SimpleGrid>
        </ModalBody>
        <ModalFooter mt="3">
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
};

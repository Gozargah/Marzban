import {
  Box,
  BoxProps,
  SimpleGrid,
  Text,
  useColorMode,
} from "@chakra-ui/react";
import { ChartBarIcon } from "@heroicons/react/24/outline";
import { ApexOptions } from "apexcharts";
import { FC, ReactNode } from "react";
import ReactApexChart from "react-apexcharts";
import { useTranslation } from "react-i18next";
import { useQuery } from "react-query";
import { fetch } from "service/http";
import { numberWithCommas } from "utils/formatByte";
import { Panel, Section } from "./ui";

export const DeviceStatsQueryKey = "device-stats-query-key";

type PlatformCount = { platform: string; count: number };
type DeviceStatsData = {
  total_devices: number;
  active_devices: number;
  revoked_devices: number;
  users_with_limit: number;
  users_over_limit: number;
  by_platform: PlatformCount[];
};

const MiniStat: FC<{ label: string; value: ReactNode; accent?: string }> = ({
  label,
  value,
  accent,
}) => (
  <Panel p="4">
    <Text fontSize="xs" color="ui.textMuted" mb="1" noOfLines={1}>
      {label}
    </Text>
    <Text fontSize="2xl" fontWeight="600" color={accent} sx={{ fontVariantNumeric: "tabular-nums" }}>
      {value}
    </Text>
  </Panel>
);

export const DeviceStats: FC<BoxProps> = (props) => {
  const { t } = useTranslation();
  const { colorMode } = useColorMode();
  const { data } = useQuery<DeviceStatsData>({
    queryKey: DeviceStatsQueryKey,
    queryFn: () => fetch("/system/devices"),
    refetchInterval: 10000,
  });

  if (!data) return null;

  const labels = data.by_platform.map((p) => p.platform);
  const series = data.by_platform.map((p) => p.count);
  const axisColor = colorMode === "dark" ? "#9298a4" : "#6b7280";

  const chartOptions: ApexOptions = {
    chart: { type: "bar", toolbar: { show: false }, animations: { enabled: false } },
    plotOptions: { bar: { horizontal: true, borderRadius: 4, barHeight: "60%" } },
    dataLabels: { enabled: true, style: { fontSize: "11px", colors: ["#fff"] } },
    xaxis: { categories: labels, labels: { style: { colors: axisColor } } },
    yaxis: { labels: { style: { colors: axisColor } } },
    tooltip: { theme: colorMode },
    grid: { borderColor: colorMode === "dark" ? "#2f3136" : "#e4e6eb" },
    colors: ["#5c7cfa"],
  };

  return (
    <Box {...props}>
      <SimpleGrid columns={{ base: 2, md: 4 }} gap="3" mb={series.length > 0 ? "4" : "0"}>
        <MiniStat
          label={t("deviceStats.activeDevices")}
          value={numberWithCommas(data.active_devices)}
        />
        <MiniStat
          label={t("deviceStats.revoked")}
          value={numberWithCommas(data.revoked_devices)}
          accent="orange.400"
        />
        <MiniStat
          label={t("deviceStats.usersWithLimit")}
          value={numberWithCommas(data.users_with_limit)}
        />
        <MiniStat
          label={t("deviceStats.usersOverLimit")}
          value={numberWithCommas(data.users_over_limit)}
          accent={data.users_over_limit > 0 ? "red.400" : undefined}
        />
      </SimpleGrid>
      {series.length > 0 && (
        <Section icon={ChartBarIcon} title={t("deviceStats.byPlatform")}>
          <ReactApexChart
            options={chartOptions}
            series={[{ name: t("deviceStats.devices"), data: series }]}
            type="bar"
            height={Math.max(140, labels.length * 38)}
          />
        </Section>
      )}
    </Box>
  );
};

import { Box, BoxProps, chakra, HStack, SimpleGrid, Text } from "@chakra-ui/react";
import {
  BoltIcon,
  ChartBarIcon,
  ChartPieIcon,
  CpuChipIcon,
  SignalIcon,
  UsersIcon,
} from "@heroicons/react/24/outline";
import { useDashboard } from "contexts/DashboardContext";
import { FC, PropsWithChildren, ReactElement, ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { useQuery } from "react-query";
import { fetch } from "service/http";
import { formatBytes, numberWithCommas } from "utils/formatByte";
import { Panel } from "./ui";

const TotalUsersIcon = chakra(UsersIcon, {
  baseStyle: {
    w: 5,
    h: 5,
    position: "relative",
    zIndex: "2",
  },
});

const NetworkIcon = chakra(ChartBarIcon, {
  baseStyle: {
    w: 5,
    h: 5,
    position: "relative",
    zIndex: "2",
  },
});

const MemoryIcon = chakra(ChartPieIcon, {
  baseStyle: {
    w: 5,
    h: 5,
    position: "relative",
    zIndex: "2",
  },
});

const OnlineIcon = chakra(SignalIcon, {
  baseStyle: { w: 5, h: 5, position: "relative", zIndex: "2" },
});

const CpuIcon = chakra(CpuChipIcon, {
  baseStyle: { w: 5, h: 5, position: "relative", zIndex: "2" },
});

const SpeedIcon = chakra(BoltIcon, {
  baseStyle: { w: 5, h: 5, position: "relative", zIndex: "2" },
});

type StatisticCardProps = {
  title: string;
  content: ReactNode;
  icon: ReactElement;
};

const StatisticCard: FC<PropsWithChildren<StatisticCardProps>> = ({
  title,
  content,
  icon,
}) => (
  <Panel p="5">
    <HStack alignItems="center" spacing="3" mb="3">
      <Box
        w="9"
        h="9"
        borderRadius="lg"
        bg="ui.accentSubtle"
        color="ui.accent"
        display="flex"
        alignItems="center"
        justifyContent="center"
        flexShrink={0}
      >
        {icon}
      </Box>
      <Text color="ui.textMuted" fontWeight="500" fontSize="sm" noOfLines={1}>
        {title}
      </Text>
    </HStack>
    <Box fontSize="2xl" fontWeight="600" sx={{ fontVariantNumeric: "tabular-nums" }} minH="9">
      {content}
    </Box>
  </Panel>
);

export const StatisticsQueryKey = "statistics-query-key";
export const Statistics: FC<BoxProps> = (props) => {
  const { version } = useDashboard();
  const { data: systemData } = useQuery({
    queryKey: StatisticsQueryKey,
    queryFn: () => fetch("/system"),
    refetchInterval: 5000,
    onSuccess: ({ version: currentVersion }) => {
      if (version !== currentVersion)
        useDashboard.setState({ version: currentVersion });
    },
  });
  const { t } = useTranslation();
  return (
    <SimpleGrid
      columns={{ base: 1, sm: 2, lg: 3 }}
      gap="3"
      {...props}
    >
      <StatisticCard
        title={t("activeUsers")}
        content={
          systemData && (
            <HStack alignItems="flex-end">
              <Text>{numberWithCommas(systemData.users_active)}</Text>
              <Text
                fontWeight="normal"
                fontSize="lg"
                as="span"
                display="inline-block"
                pb="5px"
              >
                / {numberWithCommas(systemData.total_user)}
              </Text>
            </HStack>
          )
        }
        icon={<TotalUsersIcon />}
      />
      <StatisticCard
        title={t("onlineUsers")}
        content={systemData && numberWithCommas(systemData.online_users)}
        icon={<OnlineIcon />}
      />
      <StatisticCard
        title={t("dataUsage")}
        content={
          systemData &&
          formatBytes(
            systemData.incoming_bandwidth + systemData.outgoing_bandwidth
          )
        }
        icon={<NetworkIcon />}
      />
      <StatisticCard
        title={t("liveSpeed")}
        content={
          systemData && (
            <HStack alignItems="flex-end" fontSize="xl">
              <Text>↓ {formatBytes(systemData.incoming_bandwidth_speed, 1)}/s</Text>
              <Text
                fontWeight="normal"
                fontSize="md"
                as="span"
                pb="2px"
                color="ui.textMuted"
              >
                ↑ {formatBytes(systemData.outgoing_bandwidth_speed, 1)}/s
              </Text>
            </HStack>
          )
        }
        icon={<SpeedIcon />}
      />
      <StatisticCard
        title={t("cpuUsage")}
        content={
          systemData && (
            <HStack alignItems="flex-end">
              <Text>{Math.round(systemData.cpu_usage)}%</Text>
              <Text
                fontWeight="normal"
                fontSize="lg"
                as="span"
                display="inline-block"
                pb="5px"
              >
                / {systemData.cpu_cores} {t("cores")}
              </Text>
            </HStack>
          )
        }
        icon={<CpuIcon />}
      />
      <StatisticCard
        title={t("memoryUsage")}
        content={
          systemData && (
            <HStack alignItems="flex-end">
              <Text>{formatBytes(systemData.mem_used, 1, true)[0]}</Text>
              <Text
                fontWeight="normal"
                fontSize="lg"
                as="span"
                display="inline-block"
                pb="5px"
              >
                {formatBytes(systemData.mem_used, 1, true)[1]} /{" "}
                {formatBytes(systemData.mem_total, 1)}
              </Text>
            </HStack>
          )
        }
        icon={<MemoryIcon />}
      />
    </SimpleGrid>
  );
};

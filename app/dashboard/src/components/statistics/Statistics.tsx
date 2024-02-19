import { Box, BoxProps, Card, chakra, HStack, Text } from "@chakra-ui/react";
import { ChartBarIcon, ChartPieIcon, UsersIcon } from "@heroicons/react/24/outline";
import { useDashboard } from "contexts/DashboardContext";
import { FC, PropsWithChildren, ReactElement, ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { useGetSystemStats } from "service/api";
import { formatBytes, numberWithCommas } from "utils/formatByte";
import { StatisticCard } from "./StatisticCard";

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

export const Statistics: FC<BoxProps> = (props) => {
  const { version } = useDashboard();
  const { data: systemData } = useGetSystemStats({
    query: {
      refetchInterval: 5000,
      onSuccess: ({ version: currentVersion }) => {
        if (version !== currentVersion) useDashboard.setState({ version: currentVersion });
      },
    },
  });

  const { t } = useTranslation();
  return (
    <HStack
      justifyContent="space-between"
      gap={0}
      columnGap={{ lg: 4, md: 0 }}
      rowGap={{ lg: 0, base: 4 }}
      display="flex"
      flexDirection={{ lg: "row", base: "column" }}
      {...props}
    >
      <StatisticCard
        title={t("activeUsers")}
        content={
          systemData && (
            <HStack alignItems="flex-end">
              <Text>{numberWithCommas(systemData.users_active)}</Text>
              <Text fontWeight="normal" fontSize="lg" as="span" display="inline-block" pb="5px">
                / {numberWithCommas(systemData.total_user)}
              </Text>
            </HStack>
          )
        }
        icon={<TotalUsersIcon />}
      />
      <StatisticCard
        title={t("dataUsage")}
        content={systemData && formatBytes(systemData.incoming_bandwidth + systemData.outgoing_bandwidth)}
        icon={<NetworkIcon />}
      />
      <StatisticCard
        title={t("memoryUsage")}
        content={
          systemData && (
            <HStack alignItems="flex-end">
              <Text>{formatBytes(systemData.mem_used, 1, true)[0]}</Text>
              <Text fontWeight="normal" fontSize="lg" as="span" display="inline-block" pb="5px">
                {formatBytes(systemData.mem_used, 1, true)[1]} / {formatBytes(systemData.mem_total, 1)}
              </Text>
            </HStack>
          )
        }
        icon={<MemoryIcon />}
      />
    </HStack>
  );
};

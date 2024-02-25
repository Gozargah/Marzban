import {
  Box,
  BoxProps,
  chakra,
  HStack,
  Text,
  Stat,
  StatLabel,
  StatNumber,
  useColorModeValue,
} from "@chakra-ui/react";
import {
  ArrowDownIcon,
  ArrowUpIcon,
  ChartBarIcon,
  ChartPieIcon,
  CpuChipIcon,
  ServerIcon,
  UsersIcon,
} from "@heroicons/react/24/outline";
import { CircularProgress, CircularProgressLabel } from "@chakra-ui/react";
import { FC, PropsWithChildren, ReactElement, ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { useQuery } from "react-query";
import { fetch } from "service/http";
import { formatBytes, numberWithCommas } from "utils/formatByte";
const TotalUsersIcon = chakra(UsersIcon, {
  baseStyle: {
    w: 10,
    h: 10,
    position: "relative",
    zIndex: "2",
  },
});
const NetworkIcon = chakra(ChartBarIcon, {
  baseStyle: {
    w: 10,
    h: 10,
    position: "relative",
    zIndex: "2",
  },
});
const MemoryIcon = chakra(ChartPieIcon, {
  baseStyle: {
    w: 10,
    h: 10,
    position: "relative",
    zIndex: "2",
  },
});
const CpuUsageIcon = chakra(CpuChipIcon, {
  baseStyle: {
    w: 10,
    h: 10,
    position: "relative",
    zIndex: "2",
  },
});
const TrafficIcon = chakra(ServerIcon, {
  baseStyle: {
    w: 10,
    h: 10,
    position: "relative",
    zIndex: "2",
  },
});
const IncomingIcon = chakra(ArrowDownIcon, {
  baseStyle: {
    w: 5,
    h: 5,
    position: "relative",
    zIndex: "2",
  },
});
const OutgoingIcon = chakra(ArrowUpIcon, {
  baseStyle: {
    w: 5,
    h: 5,
    position: "relative",
    zIndex: "2",
  },
});
interface StatsCardProps {
  title: string;
  stat: string;
  icon: ReactNode;
}
function StatsCard(props: StatsCardProps) {
  const { title, stat, icon } = props;
  return (
    <Stat
      borderWidth="1px"
      borderColor="light-border"
      bgGradient="linear(to-br,#F9FAFB ,  #edf6ff)"
      _dark={{ borderColor: "gray.600", bg: "gray.750" }}
      borderStyle="solid"
      boxShadow="none"
      borderRadius="12px"
      width="full"
      margin="0"
      justifyContent="space-between"
      flexDirection="row"
      px={{ base: 2, md: 2 }}
      py={"4"}
      shadow="none"
      flex-flexDirection={"row"}
    >
      <HStack justifyContent={"space-between"}>
        <Box pl={{ base: 2, md: 4 }} w="full" h="full" display="block">
          <StatLabel
            fontWeight={"medium"}
            isTruncated
            textTransform="capitalize"
            fontSize={"md"}
            paddingBottom={"4px"}
          >
            {title}
          </StatLabel>
          <StatNumber fontSize={"lg"} fontWeight={"medium"}>
            {stat}
          </StatNumber>
        </Box>
        <Box
          my={"auto"}
          color={useColorModeValue("gray.800", "gray.200")}
          alignContent={"center"}
          p="1"
          position="relative"
        >
          {icon}
        </Box>
      </HStack>
    </Stat>
  );
}
export const StatisticsQueryKey = "statistics-query-key";
export const Statistics: FC<BoxProps> = (props) => {
  const { data: systemData } = useQuery({
    queryKey: StatisticsQueryKey,
    queryFn: () => fetch("/system"),
    refetchInterval: 3000,
  });
  const { t } = useTranslation();
  return (
    <HStack
      justifyContent="space-between"
      gap={0}
      columnGap={{ lg: 2, md: 0 }}
      rowGap={{ lg: 0, base: 4 }}
      display="flex"
      flexDirection={{ lg: "row", base: "column" }}
      {...props}
    >
      <StatsCard
        title={t("activeUsers")}
        stat={
          systemData && (
            <HStack alignItems="flex-end">
              <Text>{numberWithCommas(systemData.users_active)}</Text>
              <Text
                fontWeight="normal"
                fontSize="md"
                as="span"
                display="inline-block"
                pb="2px"
              >
                / {numberWithCommas(systemData.total_user)}
              </Text>
            </HStack>
          )
        }
        icon={<TotalUsersIcon />}
      />
      <StatsCard
        title={t("dataUsage")}
        stat={
          systemData && (
            <HStack minWidth={"100px"}>
              <Text>
                {formatBytes(
                  systemData.incoming_bandwidth + systemData.outgoing_bandwidth
                )}
              </Text>
            </HStack>
          )
        }
        icon={<NetworkIcon />}
      />
      <StatsCard
        title={t("Network")}
        stat={
          systemData && (
            <HStack minWidth={"200px"} fontSize="md">
              <Text display="flex">
                {<IncomingIcon />}
                {formatBytes(systemData.incoming_bandwidth_speed / 3, 1, true)}
                {formatBytes(systemData.incoming_bandwidth_speed, 1, true)}
                /s
              </Text>
              <Text display="flex">
                {<OutgoingIcon />}
                {formatBytes(systemData.outgoing_bandwidth_speed / 3, 1, true)}
                {formatBytes(systemData.outgoing_bandwidth_speed, 1, true)}
                /s
              </Text>
            </HStack>
          )
        }
        icon={<TrafficIcon />}
      />
      <StatsCard
        title={t("Memory Usage")}
        stat={
          systemData && (
            <HStack alignItems="flex-end" minWidth={"150"}>
              <Text>{formatBytes(systemData.mem_used, 1, true)[0]}</Text>
              <Text
                fontWeight="normal"
                fontSize="md"
                as="span"
                display="inline-block"
                pb="2px"
              >
                {formatBytes(systemData.mem_used, 1, true)[1]} /{" "}
                {formatBytes(systemData.mem_total, 1)}
              </Text>
            </HStack>
          )
        }
        icon={<MemoryIcon />}
      />
      <StatsCard
        title={t("CPU Usage")}
        stat={systemData && systemData.cpu_usage + "%"}
        icon={<CpuUsageIcon />}
      />
    </HStack>
  );
};

import { Box, BoxProps, Card, chakra, HStack, Text } from "@chakra-ui/react";
import {
  ChartBarIcon,
  ChartPieIcon,
  UsersIcon,
} from "@heroicons/react/24/outline";
import { FC, PropsWithChildren, ReactElement, ReactNode } from "react";
import useSWR from "swr";
import { formatBytes, numberWithCommas } from "../utils/formatByte";

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

type StatisticCardProps = {
  title: string;
  content: ReactNode;
  icon: ReactElement;
};

const StatisticCard: FC<PropsWithChildren<StatisticCardProps>> = ({
  title,
  content,
  icon,
}) => {
  return (
    <Card
      p={6}
      borderWidth="1px"
      borderColor="light-border"
      bg="#F9FAFB"
      _dark={{ borderColor: "gray.600", bg: "gray.750" }}
      borderStyle="solid"
      boxShadow="none"
      borderRadius="12px"
      width="full"
      display="flex"
      justifyContent="space-between"
      flexDirection="row"
    >
      <HStack alignItems="center" experimental_spaceX="4">
        <Box
          p="2"
          position="relative"
          color="white"
          _before={{
            content: `""`,
            position: "absolute",
            top: 0,
            left: 0,
            bg: "primary.400",
            display: "block",
            w: "full",
            h: "full",
            borderRadius: "5px",
            opacity: ".5",
            z: "1",
          }}
          _after={{
            content: `""`,
            position: "absolute",
            top: "-5px",
            left: "-5px",
            bg: "primary.400",
            display: "block",
            w: "calc(100% + 10px)",
            h: "calc(100% + 10px)",
            borderRadius: "8px",
            opacity: ".4",
            z: "1",
          }}
        >
          {icon}
        </Box>
        <Text
          color="gray.600"
          _dark={{
            color: "gray.300",
          }}
          fontWeight="medium"
          textTransform="capitalize"
          fontSize="sm"
        >
          {title}
        </Text>
      </HStack>
      <Box fontSize="3xl" fontWeight="semibold" mt="2">
        {content}
      </Box>
    </Card>
  );
};

export const Statistics: FC<BoxProps> = (props) => {
  const { data: systemData } = useSWR("/system", {
    revalidateIfStale: true,
    revalidateOnFocus: true,
    revalidateOnReconnect: true,
    refreshInterval: 5000,
  });
  return (
    <HStack
      justifyContent="space-between"
      gap={0}
      experimental_spaceX={{ lg: "4", md: "0" }}
      experimental_spaceY={{ lg: "0", base: "4" }}
      display={{ lg: "flex", md: "block" }}
      {...props}
    >
      <StatisticCard
        title="total users"
        content={systemData && numberWithCommas(systemData.total_user)}
        icon={<TotalUsersIcon />}
      />
      <StatisticCard
        title="bandwidth usage"
        content={systemData && formatBytes(systemData.incoming_bandwidth)}
        icon={<NetworkIcon />}
      />
      <StatisticCard
        title="memory usage"
        content={
          systemData && (
            <HStack alignItems="center">
              <Text>{formatBytes(systemData.mem_used, 1)}</Text>
              <Text fontWeight="normal" fontSize="lg" as="span">
                / {formatBytes(systemData.mem_total, 1)}
              </Text>
            </HStack>
          )
        }
        icon={<MemoryIcon />}
      />
    </HStack>
  );
};

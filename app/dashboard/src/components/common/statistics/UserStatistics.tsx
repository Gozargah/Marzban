import { Box, BoxProps, HStack, Text } from "@chakra-ui/react";
import { statusColors } from "config/user-settings";
import { useDashboard } from "contexts/DashboardContext";
import { FC } from "react";
import { useTranslation } from "react-i18next";
import { useGetSystemStats } from "services/api";
import { numberWithCommas } from "utils/formatByte";
import { StatisticCard } from "./StatisticCard";

export const UserStatistics: FC<BoxProps> = (props) => {
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
  const ActiveIcon = statusColors.active.icon;
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
        title={t("users.active")}
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
        badge={systemData && parseInt(((systemData.users_active / systemData.total_user) * 100).toFixed(0))}
        badgeIcon={<ActiveIcon w="3" />}
      />
      <StatisticCard
        title={
          <>
            <Box w="10px" h="10px" bg="green.400" rounded="full" mt="5px" />
            {t("users.online")}
          </>
        }
        content={systemData && 5}
        badge={40}
        badgeIcon={<Box w="2" h="2" bg="green.400" rounded="full" mt="5px" />}
      />
      <StatisticCard title={t("users.usersOfMonth")} content={6} badge={-3} />
    </HStack>
  );
};

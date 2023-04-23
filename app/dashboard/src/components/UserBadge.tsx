import { Badge, chakra, Text } from "@chakra-ui/react";
import {
  ExclamationCircleIcon,
  ClockIcon,
  NoSymbolIcon,
  WifiIcon,
} from "@heroicons/react/24/outline";
import { statusColors } from "constants/UserSettings";
import { FC } from "react";
import { UserStatus as UserStatusType } from "types/User";
import { relativeExpiryDate } from "utils/dateFormatter";
import { useTranslation } from "react-i18next";
const iconProps = {
  baseStyle: {
    strokeWidth: "2px",
    w: 4,
    h: 4,
  },
};
const ActiveStatusIcon = chakra(WifiIcon, iconProps);
const DisabledStatusIcon = chakra(NoSymbolIcon, iconProps);
const LimitedStatusIcon = chakra(ExclamationCircleIcon, iconProps);
const ExpiredStatusIcon = chakra(ClockIcon, iconProps);

type UserStatusProps = {
  expiryDate?: number | null;
  status: UserStatusType;
  compact?: boolean;
  showDetail?: boolean;
};
export const UserBadge: FC<UserStatusProps> = ({
  expiryDate,
  status: userStatus,
  compact = false,
  showDetail = true,
}) => {
  const { t } = useTranslation();
  const dateInfo = relativeExpiryDate(expiryDate);
  return (
    <>
      <Badge
        colorScheme={statusColors[userStatus].statusColor}
        rounded="full"
        display="inline-flex"
        px={3}
        py={1}
        columnGap={2}
        alignItems="center"
      >
        {userStatus === "active" && <ActiveStatusIcon w={compact ? 3 : 4} />}
        {userStatus === "disabled" && (
          <DisabledStatusIcon w={compact ? 3 : 4} />
        )}
        {userStatus === "limited" && <LimitedStatusIcon w={compact ? 3 : 4} />}
        {userStatus === "expired" && <ExpiredStatusIcon w={compact ? 3 : 4} />}
        {showDetail && (<Text
          textTransform="capitalize"
          fontSize={compact ? ".7rem" : ".875rem"}
          lineHeight={compact ? "1rem" : "1.25rem"}
          fontWeight="medium"
          letterSpacing="tighter"
        >
          {userStatus}
        </Text>
        )}
      </Badge>
      {showDetail && expiryDate && (
        <Text
          display="inline-block"
          fontSize="xs"
          fontWeight="medium"
          ml="2"
          color="gray.600"
          _dark={{
            color: "gray.400",
          }}
        >
          {t(dateInfo.status, { time: dateInfo.time })}
        </Text>
      )}
    </>
  );
};

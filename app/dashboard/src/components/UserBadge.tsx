import { Badge, chakra, Text } from "@chakra-ui/react";
import {
  ExclamationCircleIcon,
  NoSymbolIcon,
  WifiIcon,
} from "@heroicons/react/24/outline";
import { FC } from "react";
import { UserStatus as UserStatusType } from "types/User";
import { relativeExpiryDate } from "utils/dateFormatter";
const iconProps = {
  baseStyle: {
    strokeWidth: "2px",
    w: 4,
    h: 4,
  },
};
const ActiveStatusIcon = chakra(WifiIcon, iconProps);
const LimitedIcon = chakra(NoSymbolIcon, iconProps);
const ExpiredIcon = chakra(ExclamationCircleIcon, iconProps);

const status: {
  [key: string]: {
    statusColor: string;
    bandWidthColor: string;
  };
} = {
  active: {
    statusColor: "green",
    bandWidthColor: "green",
  },
  expired: {
    statusColor: "gray",
    bandWidthColor: "gray",
  },
  limited: {
    statusColor: "red",
    bandWidthColor: "red",
  },
};
type UserStatusProps = {
  expiryDate?: number | null;
  status: UserStatusType;
};
export const UserBadge: FC<UserStatusProps> = ({
  expiryDate,
  status: userStatus,
}) => {
  let date = relativeExpiryDate(expiryDate);
  return (
    <>
      <Badge
        colorScheme={status[userStatus].statusColor}
        rounded="full"
        display="inline-flex"
        px={3}
        py={1}
        experimental_spaceX={2}
        alignItems="center"
      >
        {userStatus === "active" && <ActiveStatusIcon />}
        {userStatus === "limited" && <LimitedIcon />}
        {userStatus === "expired" && <ExpiredIcon />}
        <Text
          textTransform="capitalize"
          fontSize=".875rem"
          lineHeight="1.25rem"
          fontWeight="medium"
          letterSpacing="tighter"
        >
          {userStatus}
        </Text>
      </Badge>
      {expiryDate && (
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
          {date}
        </Text>
      )}
    </>
  );
};

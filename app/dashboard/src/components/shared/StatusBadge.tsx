import { Badge, Text } from "@chakra-ui/react";
import { statusColors } from "config/user-settings";
import { FC } from "react";
import { useTranslation } from "react-i18next";
import { Status as UserStatusType } from "types/User";
import { relativeExpiryDate } from "utils/dateFormatter";

type UserStatusProps = {
  expiryDate?: number | null;
  status: UserStatusType;
  compact?: boolean;
  showDetail?: boolean;
  extraText?: string | null;
};
export const StatusBadge: FC<UserStatusProps> = ({
  expiryDate,
  status: userStatus,
  compact = false,
  showDetail = true,
  extraText,
}) => {
  const { t } = useTranslation();
  const dateInfo = relativeExpiryDate(expiryDate);
  const Icon = statusColors[userStatus].icon;
  return (
    <>
      <Badge
        colorScheme={statusColors[userStatus].statusColor}
        display="inline-flex"
        px={2}
        columnGap={1}
        size="xs"
        alignItems="center"
      >
        <Icon w={3} />
        {showDetail && (
          <Text
            textTransform="capitalize"
            fontSize={compact ? ".7rem" : "12px"}
            lineHeight={compact ? "1rem" : "18px"}
            fontWeight="medium"
            letterSpacing="tighter"
          >
            {userStatus}
            {extraText && `: ${extraText}`}
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

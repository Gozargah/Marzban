import { Box, Tooltip } from "@chakra-ui/react";
import { FC } from "react";
import { relativeExpiryDate } from "utils/dateFormatter";

type UserStatusProps = {
  lastOnline?: string | null;
};

const convertDateFormat = (
  lastOnline: string | null | undefined
): number | null => {
  if (!lastOnline) {
    return null;
  }

  const date = new Date(lastOnline + "Z");
  return Math.floor(date.getTime() / 1000);
};

export const getRelativeLastOnlineAt = ({ lastOnline }: UserStatusProps) => {
  const currentTimeInSeconds = Math.floor(Date.now() / 1000);
  const unixTime = convertDateFormat(lastOnline);

  const timeDifferenceInSeconds = unixTime
    ? currentTimeInSeconds - unixTime
    : null;
  const dateInfo = unixTime
    ? relativeExpiryDate(unixTime)
    : { status: "", time: "Not Connected Yet" };

  return timeDifferenceInSeconds && timeDifferenceInSeconds <= 60
    ? "Online"
    : timeDifferenceInSeconds
    ? `${dateInfo.time} ago`
    : dateInfo.time;
};

export const OnlineBadge: FC<UserStatusProps> = ({ lastOnline }) => {
  const currentTimeInSeconds = Math.floor(Date.now() / 1000);
  const unixTime = convertDateFormat(lastOnline);

  const timeDifferenceInSeconds = unixTime
    ? currentTimeInSeconds - unixTime
    : Infinity;

  return (
    <Tooltip
      label={getRelativeLastOnlineAt({ lastOnline: lastOnline ?? null })}
      placement="top"
    >
      {typeof lastOnline === "undefined" || lastOnline === null ? (
        <Box h={3} w={3} rounded="full" bg="yellow.500" />
      ) : timeDifferenceInSeconds > 0 && timeDifferenceInSeconds <= 60 ? (
        <Box h={3} w={3} rounded="full" bg="green.500" />
      ) : (
        <Box h={3} w={3} rounded="full" bg="red.500" />
      )}
    </Tooltip>
  );
};

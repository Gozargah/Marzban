import { Box, BoxProps, Tooltip } from "@chakra-ui/react";
import { FC } from "react";
import { relativeExpiryDate } from "utils/dateFormatter";

type UserStatusProps = {
  lastOnline?: string | null;
};

export const convertDateFormat = (lastOnline: string | null | undefined): number | null => {
  if (!lastOnline) {
    return null;
  }

  const date = new Date(lastOnline + "Z");
  return Math.floor(date.getTime() / 1000);
};

export const humanizeRelativeLastOnline = (lastOnline: string) => {
  if (lastOnline.includes("ago")) return `Was online ${lastOnline}`;
  if (lastOnline.toLowerCase() === "online") return `Online`;
  return `Not connected yet`;
};

export const getRelativeLastOnlineAt = ({ lastOnline }: UserStatusProps) => {
  const currentTimeInSeconds = Math.floor(Date.now() / 1000);
  const unixTime = convertDateFormat(lastOnline);

  const timeDifferenceInSeconds = unixTime ? currentTimeInSeconds - unixTime : null;
  const dateInfo = unixTime ? relativeExpiryDate(unixTime) : { status: "", time: "Not Connected Yet" };

  return timeDifferenceInSeconds && timeDifferenceInSeconds <= 60
    ? "Online"
    : timeDifferenceInSeconds
    ? `${dateInfo.time} ago`
    : dateInfo.time;
};

const statusStyles: Record<"online" | "offline" | "not_connected", BoxProps> = {
  online: {
    bg: "green.400",
    _dark: {
      bg: "green.500",
    },
  },
  offline: {
    bg: "gray.400",
    _dark: {
      bg: "gray.600",
    },
  },
  not_connected: {
    border: "1px solid",
    borderColor: "gray.400",
    _dark: {
      borderColor: "gray.600",
    },
  },
};

export const OnlineBadge: FC<UserStatusProps> = ({ lastOnline }) => {
  const currentTimeInSeconds = Math.floor(Date.now() / 1000);
  const unixTime = convertDateFormat(lastOnline);

  const timeDifferenceInSeconds = unixTime ? currentTimeInSeconds - unixTime : Infinity;

  const status =
    typeof lastOnline === "undefined" || lastOnline === null
      ? "not_connected"
      : timeDifferenceInSeconds > 0 && timeDifferenceInSeconds <= 60
      ? "online"
      : "offline";

  return (
    <Tooltip label={getRelativeLastOnlineAt({ lastOnline: lastOnline ?? null })} placement="top">
      <Box display={{ base: "none", md: "block" }} h={3} w={3} rounded="full" {...statusStyles[status]} />
    </Tooltip>
  );
};

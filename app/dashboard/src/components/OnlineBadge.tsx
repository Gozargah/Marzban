import { Box } from "@chakra-ui/react";
import { FC } from "react";

type UserStatusProps = {
  lastOnline?: string | null;
};

const convertDateFormat = (lastOnline?: string | null): number | null => {
  if (!lastOnline) return null;

  const date = new Date(`${lastOnline}Z`);
  return Math.floor(date.getTime() / 1000);
};

export const OnlineBadge: FC<UserStatusProps> = ({ lastOnline }) => {
  const currentTimeInSeconds = Math.floor(Date.now() / 1000);
  const unixTime = convertDateFormat(lastOnline);

  if (!lastOnline || unixTime === null) {
    return (
      <Box
        border="1px solid"
        borderColor="gray.400"
        _dark={{ borderColor: "gray.600" }}
        className="circle"
      />
    );
  }

  const timeDifferenceInSeconds = currentTimeInSeconds - unixTime;

  if (timeDifferenceInSeconds <= 60) {
    return (
      <Box
        bg="green.300"
        _dark={{ bg: "green.500" }}
        className="circle pulse green"
      />
    );
  }

  return <Box bg="gray.400" _dark={{ bg: "gray.600" }} className="circle" />;
};

import { Text } from "@chakra-ui/react";

import { FC } from "react";
import { relativeExpiryDate } from "utils/dateFormatter";

type UserStatusProps = {
  lastOnline?: string | null;
};

export const OnlineStatus: FC<UserStatusProps> = ({ lastOnline }) => {
  const convertDateFormat = (
    lastOnline: string | null | undefined
  ): number | null => {
    if (lastOnline === null || lastOnline === undefined) {
      // Handle the case where lastOnline is null or undefined
      return null;
    }

    // Parse the input date string
    const gmtDate = new Date(lastOnline + "Z"); // Append 'Z' to indicate it's in GMT

    // Get the browser's time zone
    const browserTimeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;

    // Create a new date object with the browser's time zone
    const localDate = new Date(
      gmtDate.toLocaleString(undefined, { timeZone: browserTimeZone })
    );

    // Calculate the Unix timestamp (in seconds)
    const unixTimestamp = Math.floor(localDate.getTime() / 1000);

    return unixTimestamp;
  };
  const currentTimeInSeconds = Math.floor(Date.now() / 1000); // Current time in seconds

  const unixTime = convertDateFormat(lastOnline);

  const timeDifferenceInSeconds = unixTime
    ? currentTimeInSeconds - unixTime
    : 0;

  const dateInfo = relativeExpiryDate(convertDateFormat(lastOnline));

  return (
    <>
      
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
          {timeDifferenceInSeconds <= 61 && timeDifferenceInSeconds > 0 && "Online"}
          {timeDifferenceInSeconds > 61 && `${dateInfo.time} ago`}
          {timeDifferenceInSeconds === 0 && "No Data"}
        </Text>
      
    </>
  );
};

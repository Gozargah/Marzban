import { FC } from "react";

type UserStatusProps = {
  lastOnline?: string | null;
};

export const OnlineBadge: FC<UserStatusProps> = ({ lastOnline }) => {
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

  if (timeDifferenceInSeconds <= 61 && timeDifferenceInSeconds > 0)
    return <div className="circle pulse green"></div>;
  else if (timeDifferenceInSeconds === 0)
    return <div className="circle pulse orange"></div>;

  return <div className="circle pulse red"></div>;
};

import { FC } from "react";
import { cn } from "@/lib/utils";
import { relativeExpiryDate } from "@/utils/dateFormatter";

type UserStatusProps = {
  lastOnline: string | null;
};

const convertDateFormat = (lastOnline: string | null): number | null => {
  if (!lastOnline) {
    return null;
  }

  const date = new Date(lastOnline + "Z");
  return Math.floor(date.getTime() / 1000);
};

export const OnlineStatus: FC<UserStatusProps> = ({ lastOnline }) => {
  const currentTimeInSeconds = Math.floor(Date.now() / 1000);
  const unixTime = convertDateFormat(lastOnline);

  const timeDifferenceInSeconds = unixTime ? currentTimeInSeconds - unixTime : null;
  const dateInfo = unixTime ? relativeExpiryDate(unixTime) : { status: "", time: "Not Connected Yet" };

  return (
    <span
    dir="ltr"
      className={cn(
        "inline-block text-xs font-medium ml-2 text-gray-600 dark:text-gray-400"
      )}
    >
      {timeDifferenceInSeconds && timeDifferenceInSeconds <= 60
        ? "Online"
        : timeDifferenceInSeconds
        ? `${dateInfo.time} ago`
        : dateInfo.time}
    </span>
  );
};

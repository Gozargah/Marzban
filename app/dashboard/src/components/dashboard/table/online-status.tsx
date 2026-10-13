import { FC } from "react";
import { relativeExpiryDate } from "utils/dateFormatter";
import { cn } from "@/lib/utils";

type UserStatusProps = {
  lastOnline: string | null;
  className?: string;
};

const convertDateFormat = (lastOnline: string | null): number | null => {
  if (!lastOnline) {
    return null;
  }

  const date = new Date(lastOnline + "Z");
  return Math.floor(date.getTime() / 1000);
};

export const OnlineStatus: FC<UserStatusProps> = ({ lastOnline, className }) => {
  const currentTimeInSeconds = Math.floor(Date.now() / 1000);
  const unixTime = convertDateFormat(lastOnline);

  const timeDifferenceInSeconds = unixTime ? currentTimeInSeconds - unixTime : null;
  const dateInfo = unixTime ? relativeExpiryDate(unixTime) : { status: "", time: "Not Connected Yet" };

  return (
    <span
      className={cn(
        "inline-block text-xs font-medium text-muted-foreground",
        className
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

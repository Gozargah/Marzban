import { FC } from "react";
import { cn } from "@/lib/utils";

type UserStatusProps = {
  lastOnline?: string | null;
  className?: string;
};

const convertDateFormat = (lastOnline?: string | null): number | null => {
  if (!lastOnline) return null;

  const date = new Date(`${lastOnline}Z`);
  return Math.floor(date.getTime() / 1000);
};

export const OnlineBadge: FC<UserStatusProps> = ({ lastOnline, className }) => {
  const currentTimeInSeconds = Math.floor(Date.now() / 1000);
  const unixTime = convertDateFormat(lastOnline);

  if (!lastOnline || unixTime === null) {
    return (
      <span
        className={cn(
          "inline-block size-2 rounded-full border border-neutral-400 dark:border-neutral-600 shrink-0",
          className
        )}
      />
    );
  }

  const timeDifferenceInSeconds = currentTimeInSeconds - unixTime;

  if (timeDifferenceInSeconds <= 60) {
    return (
      <span
        className={cn(
          "inline-block size-2 rounded-full bg-emerald-500 shadow-[0_0_0_2px_rgba(16,185,129,0.3)] shrink-0 animate-pulse",
          className
        )}
      />
    );
  }

  return (
    <span
      className={cn(
        "inline-block size-2 rounded-full bg-neutral-400 dark:bg-neutral-600 shrink-0",
        className
      )}
    />
  );
};

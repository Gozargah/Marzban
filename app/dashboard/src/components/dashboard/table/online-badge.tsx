import { FC } from "react";
import { cn } from "@/lib/utils";

type UserStatusProps = {
  lastOnline?: string | null;
  className?: string;
};

const convertDateFormat = (lastOnline?: string | null): number | null => {
  if (!lastOnline) return null;

  const date = new Date(/(?:Z|[+-]\d{2}:?\d{2})$/i.test(lastOnline) ? lastOnline : `${lastOnline}Z`);
  return Number.isFinite(date.getTime()) ? Math.floor(date.getTime() / 1000) : null;
};

export const OnlineBadge: FC<UserStatusProps> = ({ lastOnline, className }) => {
  const currentTimeInSeconds = Math.floor(Date.now() / 1000);
  const unixTime = convertDateFormat(lastOnline);

  if (!lastOnline || unixTime === null) {
    return (
      <span aria-hidden="true"
        className={cn(
          "inline-block size-2 rounded-full border border-neutral-400 dark:border-neutral-600 shrink-0",
          className
        )}
      />
    );
  }

  const timeDifferenceInSeconds = currentTimeInSeconds - unixTime;

  if (timeDifferenceInSeconds >= -60 && timeDifferenceInSeconds <= 60) {
    return (
      <span aria-hidden="true"
        className={cn(
          "inline-block size-2 rounded-full bg-success shrink-0",
          className
        )}
      />
    );
  }

  return (
    <span aria-hidden="true"
      className={cn(
        "inline-block size-2 rounded-full bg-neutral-400 dark:bg-neutral-600 shrink-0",
        className
      )}
    />
  );
};

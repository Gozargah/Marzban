import { useLocale } from "@/hooks/use-locale";
import { FC } from "react";
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/utils";

type UserStatusProps = {
  lastOnline: string | null;
  className?: string;
};

const convertDateFormat = (lastOnline: string | null): number | null => {
  if (!lastOnline) {
    return null;
  }

  const date = new Date(/(?:Z|[+-]\d{2}:?\d{2})$/i.test(lastOnline) ? lastOnline : lastOnline + "Z");
  return Number.isFinite(date.getTime()) ? Math.floor(date.getTime() / 1000) : null;
};

export const OnlineStatus: FC<UserStatusProps> = ({ lastOnline, className }) => {
  const { t } = useTranslation();
  const { language } = useLocale();
  const currentTimeInSeconds = Math.floor(Date.now() / 1000);
  const unixTime = convertDateFormat(lastOnline);

  const timeDifferenceInSeconds = unixTime ? currentTimeInSeconds - unixTime : null;
  let label = t("usersTable.notConnected");
  if (timeDifferenceInSeconds !== null) {
    if (timeDifferenceInSeconds >= -60 && timeDifferenceInSeconds <= 60) {
      label = t("usersTable.online");
    } else {
      const seconds = -timeDifferenceInSeconds;
      const units = [[31536000, "year"], [2592000, "month"], [86400, "day"], [3600, "hour"], [60, "minute"], [1, "second"]] as const;
      const [size, unit] = units.find(([size]) => Math.abs(seconds) >= size) || units[units.length - 1];
      label = new Intl.RelativeTimeFormat(language, { numeric: "auto" }).format(Math.trunc(seconds / size), unit);
    }
  }

  return (
    <span
      className={cn(
        "inline-block text-xs font-medium text-muted-foreground",
        className
      )}
    >
      {label}
    </span>
  );
};

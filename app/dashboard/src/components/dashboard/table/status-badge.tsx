import { FC } from "react";
import { useTranslation } from "react-i18next";
import { Status as UserStatusType } from "types/User";
import { relativeExpiryDate } from "utils/dateFormatter";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import {
  ClockIcon,
  ExclamationCircleIcon,
  NoSymbolIcon,
  WifiIcon,
} from "@heroicons/react/24/outline";

type UserStatusProps = {
  expiryDate?: number | null;
  status: UserStatusType;
  compact?: boolean;
  showDetail?: boolean;
  extraText?: string | null;
  className?: string;
};

const statusConfig: Record<
  string,
  {
    variant: "success" | "warning" | "destructive" | "purple" | "secondary";
    icon: typeof WifiIcon;
  }
> = {
  active: { variant: "success", icon: WifiIcon },
  connected: { variant: "success", icon: WifiIcon },
  disabled: { variant: "secondary", icon: NoSymbolIcon },
  expired: { variant: "warning", icon: ClockIcon },
  on_hold: { variant: "purple", icon: ClockIcon },
  limited: { variant: "destructive", icon: ExclamationCircleIcon },
  connecting: { variant: "warning", icon: WifiIcon },
  error: { variant: "destructive", icon: ExclamationCircleIcon },
};

export const StatusBadge: FC<UserStatusProps> = ({
  expiryDate,
  status: userStatus,
  compact = false,
  showDetail = true,
  extraText,
  className,
}) => {
  const { t } = useTranslation();
  const dateInfo = relativeExpiryDate(expiryDate);
  const config = statusConfig[userStatus] || { variant: "secondary", icon: WifiIcon };
  const Icon = config.icon;

  return (
    <span className={cn("inline-flex items-center flex-wrap gap-1.5", className)}>
      <Badge
        variant={config.variant}
        className={cn(
          "gap-1 font-medium capitalize",
          compact ? "px-2 py-0.5 text-[0.7rem]" : "px-2.5 py-1 text-xs"
        )}
      >
        <Icon className={cn(compact ? "size-3" : "size-3.5")} />
        {showDetail && (
          <span>
            {userStatus && t(`status.${userStatus}`)}
            {extraText && `: ${extraText}`}
          </span>
        )}
      </Badge>
      {showDetail && expiryDate && (
        <span className="text-xs font-medium text-muted-foreground whitespace-nowrap">
          {t(dateInfo.status, { time: dateInfo.time })}
        </span>
      )}
    </span>
  );
};

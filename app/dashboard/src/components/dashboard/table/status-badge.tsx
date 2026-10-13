import { FC } from "react";
import { useTranslation } from "react-i18next";
import { AlertCircle, Ban, Clock, type LucideIcon, Wifi } from "lucide-react";
import { Status as UserStatusType } from "types/User";
import { relativeExpiryDate } from "utils/dateFormatter";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

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
    className: string;
    icon: LucideIcon;
  }
> = {
  active: { className: "border-success-border bg-success-soft text-success", icon: Wifi },
  connected: { className: "border-success-border bg-success-soft text-success", icon: Wifi },
  disabled: { className: "border-border bg-secondary text-secondary-foreground", icon: Ban },
  expired: { className: "border-warning-border bg-warning-soft text-warning", icon: Clock },
  on_hold: { className: "border-border bg-muted text-muted-foreground", icon: Clock },
  limited: { className: "border-destructive/20 bg-destructive/10 text-destructive", icon: AlertCircle },
  connecting: { className: "border-warning-border bg-warning-soft text-warning", icon: Wifi },
  error: { className: "border-destructive/20 bg-destructive/10 text-destructive", icon: AlertCircle },
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
  const config = statusConfig[userStatus] || { className: "border-border bg-secondary text-secondary-foreground", icon: Wifi };
  const Icon = config.icon;

  return (
    <span className={cn("inline-flex items-center flex-wrap gap-1.5", className)}>
      <Badge
        variant="secondary"
        className={cn(
          "rounded-none gap-1 font-medium capitalize",
          config.className,
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

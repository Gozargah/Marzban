import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { FC } from "react";
import { useTranslation } from "react-i18next";
import { Status as UserStatusType } from "@/types/User";
import { relativeExpiryDate } from "@/utils/dateFormatter";
import { statusColors } from "@/constants/UserSettings";
import useDirDetection from "@/hooks/use-dir-detection";

type UserStatusProps = {
  expiryDate?: number | null;
  status: UserStatusType;
  extraText?: string | null;
  isMobile?: boolean;
};

export const StatusBadge: FC<UserStatusProps> = ({
  expiryDate,
  status: userStatus,
  extraText,
  isMobile
}) => {
  const { t } = useTranslation();
  const dir =useDirDetection()
  const dateInfo = relativeExpiryDate(expiryDate);

  const Icon = statusColors[userStatus]?.icon;

  return (
    <>
      <Badge
        className={cn(
          "flex items-center justify-center rounded-full px-3 py-1 w-fit max-w-[150px] gap-x-2 pointer-events-none",
          statusColors[userStatus]?.statusColor || "bg-gray-400 text-white",
          isMobile && "py-0 h-6"
        )}
      >
        {Icon && <Icon className={cn(isMobile? "w-3 h-3": "w-4 h-4")} />}
        <div className={cn(isMobile ? "block" : "hidden md:block")}>
          <span className={cn("capitalize font-medium text-sm leading-5" , isMobile && "text-[11.1px] leading-3")}>
            {userStatus && t(`status.${userStatus}`)}
            {extraText && `: ${extraText}`}
          </span>
        </div>
      </Badge>
      <div className={cn(!dateInfo.time && !dateInfo.status && "hidden")}>
        <div className={cn(isMobile ? "block" : "hidden md:block")}>
          <span
            className={cn(
              "inline-block text-xs font-medium ml-2 text-gray-600 dark:text-gray-400",
              dir === "rtl" && "ml-0 mr-1"
            )}
          >
            {t(dateInfo.status, { time: dateInfo.time })}
          </span>
        </div>
      </div>
    </>
  );
};

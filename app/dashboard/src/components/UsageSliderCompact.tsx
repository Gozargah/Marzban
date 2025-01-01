import { formatBytes } from "@/utils/formatByte";
import { Progress } from "./ui/progress";
import { statusColors } from "@/constants/UserSettings";
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/utils";

type UsageSliderProps = {
  used: number;
  total: number | null;
  dataLimitResetStrategy: string;
  totalUsedTraffic: number;
  status: string;
  isMobile?: boolean;
};

const UsageSliderCompact: React.FC<UsageSliderProps> = ({
  used,
  total,
  status,
  dataLimitResetStrategy,
  totalUsedTraffic,
  isMobile,
}) => {
  const isUnlimited = total === 0 || total === null;
  const progressValue = isUnlimited ? 100 : (used / total) * 100;
  const color = statusColors[status]?.sliderColor;
  const { t } = useTranslation();
  return (
    <div className="flex flex-col justify-between text-xs font-medium w-full gap-y-2">
      <Progress
        indicatorClassName={color}
        value={progressValue}
        className={cn(isMobile ? "block" : "hidden md:block")}
      />
      <div className="flex items-center justify-between">
        <span dir="ltr">
          {formatBytes(used)} /{" "}
          {isUnlimited ? (
            <span className="font-system-ui">∞</span>
          ) : (
            formatBytes(total)
          )}
        </span>
        <span className={cn(isMobile ? "block" : "hidden md:block")}>
          {t("usersTable.total")}: {formatBytes(totalUsedTraffic)}
        </span>
      </div>
    </div>
  );
};
export default UsageSliderCompact;

import { FC, PropsWithChildren, ReactElement, ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { useQuery } from "react-query";
import { fetch } from "@/service/http";
import { formatBytes, numberWithCommas } from "@/utils/formatByte";
import { Card } from "@/components/ui/card";
import { Textarea } from "./ui/textarea";
import { BarChart, PieChart, User } from "lucide-react";
import { useDashboard } from "@/contexts/DashboardContext";

const TotalUsersIcon = User;
const NetworkIcon = BarChart;
const MemoryIcon = PieChart;

type StatisticCardProps = {
  title: string;
  content: ReactNode;
  icon: ReactElement;
};

const StatisticCard: FC<PropsWithChildren<StatisticCardProps>> = ({
  title,
  content,
  icon,
}) => {
  return (
    <Card className="p-6 border border-light-border bg-light-gray dark:border-gray-600 dark:bg-gray-750 rounded-lg w-full flex justify-between">
      <div className="flex items-center gap-4">
        <div className="p-2 relative text-white before:content-[''] before:absolute before:top-0 before:left-0 before:bg-primary-400 before:w-full before:h-full before:rounded-[5px] before:opacity-50 after:content-[''] after:absolute after:top-[-5px] after:left-[-5px] after:bg-primary-400 after:w-[calc(100%+10px)] after:h-[calc(100%+10px)] after:rounded-[8px] after:opacity-40">
          {icon}
        </div>
        <Textarea className="text-gray-600 dark:text-gray-300 font-medium text-sm capitalize">
          {title}
        </Textarea>
      </div>
      <div className="text-3xl font-semibold mt-2">{content}</div>
    </Card>
  );
};

export const StatisticsQueryKey = "statistics-query-key";

export const Statistics: FC = () => {
  const { version } = useDashboard();
  const { data: systemData } = useQuery({
    queryKey: StatisticsQueryKey,
    queryFn: () => fetch("/system"),
    refetchInterval: 5000,
    onSuccess: ({ version: currentVersion }) => {
      if (version !== currentVersion)
        useDashboard.setState({ version: currentVersion });
    },
  });
  const { t } = useTranslation();

  return (
    <div className="flex flex-wrap justify-between gap-4">
      <StatisticCard
        title={t("activeUsers")}
        content={
          systemData && (
            <div className="flex items-end">
              <Textarea>{numberWithCommas(systemData.users_active)}</Textarea>
              <Textarea className="font-normal Textarea-lg inline-block pb-[5px]">
                / {numberWithCommas(systemData.total_user)}
              </Textarea>
            </div>
          )
        }
        icon={<TotalUsersIcon className="w-5 h-5" />}
      />
      <StatisticCard
        title={t("dataUsage")}
        content={
          systemData &&
          formatBytes(
            systemData.incoming_bandwidth + systemData.outgoing_bandwidth
          )
        }
        icon={<NetworkIcon className="w-5 h-5" />}
      />
      <StatisticCard
        title={t("memoryUsage")}
        content={
          systemData && (
            <div className="flex items-end">
              <Textarea>{formatBytes(systemData.mem_used, 1, true)[0]}</Textarea>
              <Textarea className="font-normal text-lg inline-block pb-[5px]">
                {formatBytes(systemData.mem_used, 1, true)[1]} /{" "}
                {formatBytes(systemData.mem_total, 1)}
              </Textarea>
            </div>
          )
        }
        icon={<MemoryIcon className="w-5 h-5" />}
      />
    </div>
  );
};

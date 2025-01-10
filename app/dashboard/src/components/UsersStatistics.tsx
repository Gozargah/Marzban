import useDirDetection from "@/hooks/use-dir-detection";
import { useTranslation } from "react-i18next";
import { Card, CardTitle } from "./ui/card";
import { cn } from "@/lib/utils";
import { useQuery } from "react-query";
import { StatisticsQueryKey } from "./Statistics";
import { fetcher } from "@/service/http";
import { Button } from "./ui/button";
import { Plus, Users, Wifi } from "lucide-react";
import { numberWithCommas } from "@/utils/formatByte";

const UsersStatistics = () => {
  const { t } = useTranslation();
  const dir = useDirDetection();

  const { data } = useQuery({
    queryKey: StatisticsQueryKey,
    queryFn: () => fetcher.get("/system"),
    refetchInterval: 5000,
  });
  return (
    <div className="flex flex-col gap-y-4 mb-4">
      <div dir={dir} className="flex items-center justify-between flex-wrap gap-4 mb-2">
        <div dir={dir} className="flex flex-col gap-y-2">
          <h1 className="font-semibold text-2xl sm:text-3xl">{t("users")}</h1>
          <span className="text-muted-foreground text-xs sm:text-sm">
            {t("manageAccounts")}
          </span>
        </div>
        <div>
          <Button className="flex items-center">
            <Plus />
            <span>{t("createUser")}</span>
          </Button>
        </div>
      </div>
      <div
        className={cn(
          "flex flex-col lg:flex-row items-center justify-between gap-x-8 gap-y-4",
          dir === "rtl" && "lg:flex-row-reverse"
        )}
      >
        {/* Online Users */}
        <Card dir={dir} className="py-7 px-5 w-full rounded-xl">
          <CardTitle className="flex items-center justify-between gap-x-4">
            <div className="flex items-center gap-x-4">
              <div className="min-h-[10px] min-w-[10px] rounded-full bg-green-300 dark:bg-green-500 shadow-sm animate-greenPulse" />

              <span className="text-lg">{t("onlineUsers")}</span>
            </div>
            <span className="text-3xl mx-2">{numberWithCommas(data?.online_users)}</span>
          </CardTitle>
        </Card>
        <Card dir={dir} className="py-7 px-5 w-full rounded-xl">
          <CardTitle className="flex items-center justify-between gap-x-4">
            <div className="flex items-center gap-x-4">
              <Wifi className="h-5 w-5" />
              <span className="text-lg">{t("activeUsers")}</span>
            </div>
            <span className="text-3xl mx-2">{numberWithCommas(data?.users_active)}</span>
          </CardTitle>
        </Card>
        <Card dir={dir} className="py-7 px-5 w-full rounded-xl">
          <CardTitle className="flex items-center justify-between gap-x-4">
            <div className="flex items-center gap-x-4">
              <Users className="h-5 w-5" />
              <span className="text-lg">{t("totalUsers")}</span>
            </div>
            <span className="text-3xl mx-2">{numberWithCommas(data?.total_user)}</span>
          </CardTitle>
        </Card>
      </div>
    </div>
  );
};

export default UsersStatistics;

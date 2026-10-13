import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import dayjs from "dayjs";
import ReactApexChart from "react-apexcharts";
import { useTranslation } from "react-i18next";
import { ChartPie } from "lucide-react";
import { FilterUsageType, useDashboard } from "contexts/DashboardContext";
import { useNodes } from "contexts/NodesContext";
import { useTheme } from "@/components/theme-provider";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Spinner } from "@/components/ui/spinner";
import { UsageFilter, createUsageConfig } from "./usage-filter";

export function NodesUsage() {
  const { isShowingNodesUsage, onShowingNodesUsage } = useDashboard();
  const { fetchNodesUsage } = useNodes();
  const { resolvedTheme } = useTheme();
  const { t, i18n } = useTranslation();
  const [data, setData] = useState<{ series: number[]; labels: string[] }>({ series: [], labels: [] });
  const [loading, setLoading] = useState(false);
  const [failed, setFailed] = useState(false);
  const [filter, setFilter] = useState("1m");
  const request = useRef(0);
  const fetchUsage = useCallback(
    async (query: FilterUsageType) => {
      const token = ++request.current;
      setLoading(true);
      setFailed(false);
      try {
        const response = (await fetchNodesUsage(query)) as unknown as {
          usages: { uplink: number; downlink: number; node_name: string }[];
        };
        if (token !== request.current) return;
        const usages = Object.values(response.usages);
        setData({
          series: usages.map((entry) => entry.uplink + entry.downlink),
          labels: usages.map((entry) => entry.node_name),
        });
      } catch {
        if (token === request.current) setFailed(true);
      } finally {
        if (token === request.current) setLoading(false);
      }
    },
    [fetchNodesUsage],
  );
  useEffect(() => {
    if (isShowingNodesUsage) {
      setFilter("1m");
      fetchUsage({ start: dayjs().utc().subtract(30, "day").format("YYYY-MM-DDTHH:00:00") });
    }
    return () => {
      request.current++;
    };
  }, [isShowingNodesUsage, fetchUsage]);
  const title = t("userDialog.total");
  const usage = useMemo(
    () => createUsageConfig(resolvedTheme, title, data.series, data.labels),
    [resolvedTheme, title, data],
  );
  return (
    <Dialog open={isShowingNodesUsage} onOpenChange={onShowingNodesUsage}>
      <DialogContent
        className="max-h-[calc(100dvh-2rem)] overflow-y-auto sm:max-w-2xl"
        dir={i18n.dir()}
        aria-describedby={undefined}
      >
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-lg">
            <ChartPie className="size-5 text-primary" />
            {t("header.nodesUsage")}
          </DialogTitle>
        </DialogHeader>
        <UsageFilter
          key={isShowingNodesUsage ? "open" : "closed"}
          defaultValue={filter}
          onChange={(next, query) => {
            setFilter(next);
            fetchUsage(query);
          }}
        />
        {loading ? (
          <Spinner className="mx-auto" />
        ) : failed ? (
          <Alert variant="destructive">
            <AlertDescription>
              {t("nodes.usageError", { defaultValue: "Could not load usage. Please try another range." })}
            </AlertDescription>
          </Alert>
        ) : (
          <div className="mx-auto w-full max-w-md">
            <ReactApexChart options={usage.options} series={usage.series} type="donut" height={360} />
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

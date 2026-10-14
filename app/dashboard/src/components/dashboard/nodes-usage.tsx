import { Alert, AlertDescription } from "@/components/ui/alert";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Spinner } from "@/components/ui/spinner";
import { FilterUsageType, useDashboard } from "@/contexts/dashboard-context";
import { useNodes } from "@/contexts/nodes-context";
import { createUsageData } from "@/features/shared/traffic";
import { useLocale } from "@/hooks/use-locale";
import dayjs from "dayjs";
import { ChartPie } from "lucide-react";
import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { createLatestRequest } from "utils/latest-request";
import { UsageFilter } from "./usage-filter";

const TrafficChart = lazy(() => import("@/features/shared/traffic-chart").then((module) => ({ default: module.TrafficChart })));

export function NodesUsage() {
  const isShowingNodesUsage = useDashboard((state) => state.isShowingNodesUsage);
  const onShowingNodesUsage = useDashboard((state) => state.onShowingNodesUsage);
  const fetchNodesUsage = useNodes((state) => state.fetchNodesUsage);
  const { t } = useTranslation();
  const { direction } = useLocale();
  const [data, setData] = useState<{ series: number[]; labels: string[] }>({ series: [], labels: [] });
  const [loading, setLoading] = useState(false);
  const [failed, setFailed] = useState(false);
  const [filter, setFilter] = useState("1m");
  const request = useRef(createLatestRequest());
  const fetchUsage = useCallback(
    async (query: FilterUsageType) => {
      const pending = request.current.start();
      setLoading(true);
      setFailed(false);
      try {
        const response = (await fetchNodesUsage(query, pending.signal)) as unknown as {
          usages: { uplink: number; downlink: number; node_name: string }[];
        };
        if (!pending.isCurrent()) return;
        const usages = Object.values(response.usages);
        setData({
          series: usages.map((entry) => entry.uplink + entry.downlink),
          labels: usages.map((entry) => entry.node_name),
        });
      } catch {
        if (pending.isCurrent()) setFailed(true);
      } finally {
        if (pending.isCurrent()) setLoading(false);
        pending.finish();
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
      request.current.cancel();
    };
  }, [isShowingNodesUsage, fetchUsage]);
  const usage = useMemo(
    () => createUsageData(data.series, data.labels),
    [data],
  );
  return (
    <Dialog open={isShowingNodesUsage} onOpenChange={onShowingNodesUsage}>
      <DialogContent
        className="max-h-[calc(100dvh-2rem)] overflow-y-auto sm:max-w-2xl"
        dir={direction}
        aria-describedby={undefined}
      >
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-lg">
            <ChartPie className="size-5 text-primary-text" />
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
            <Suspense fallback={<Spinner aria-label={t("loading")} />}><TrafficChart usage={usage} height={360} /></Suspense>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

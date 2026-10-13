import { useQuery } from "@tanstack/react-query";
import { ChartColumn, MemoryStick, Users, type LucideIcon } from "lucide-react";
import type { ComponentProps, ReactNode } from "react";
import { useTranslation } from "react-i18next";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { fetch } from "service/http";
import { formatBytes, numberWithCommas } from "utils/formatByte";

type SystemStatistics = {
  users_active: number;
  total_user: number;
  incoming_bandwidth: number;
  outgoing_bandwidth: number;
  mem_used: number;
  mem_total: number;
};

type StatisticCardProps = {
  title: string;
  content: ReactNode;
  icon: LucideIcon;
};

function StatisticCard({ title, content, icon: Icon }: StatisticCardProps) {
  return (
    <Card className="py-0 shadow-none">
      <CardContent className="p-6">
        <dl className="flex flex-wrap items-center justify-between gap-4">
          <dt className="flex items-center gap-3 text-sm font-medium text-muted-foreground">
            <span aria-hidden="true" className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary ring-1 ring-primary/20">
              <Icon className="size-5" />
            </span>
            {title}
          </dt>
          <dd className="min-w-0 text-3xl font-semibold tabular-nums">{content}</dd>
        </dl>
      </CardContent>
    </Card>
  );
}

export const StatisticsQueryKey = "statistics-query-key";

export function Statistics({ className, ...props }: ComponentProps<"section">) {
  const { t, i18n } = useTranslation();
  const { data, isPending, isError, isFetching, refetch } = useQuery({
    queryKey: [StatisticsQueryKey],
    queryFn: ({ signal }) => fetch<SystemStatistics>("/system", { signal, retry: 0 }),
    staleTime: 5000,
    refetchInterval: 5000,
    retry: false,
  });
  const memory = data ? formatBytes(data.mem_used, 1, true) : undefined;
  const placeholder = <span className="text-muted-foreground" aria-hidden="true">—</span>;

  return (
    <section
      aria-label={t("statistics.title", { defaultValue: "System statistics" })}
      aria-busy={isPending}
      dir={i18n.dir()}
      className={cn("mt-4 space-y-4", className)}
      {...props}
    >
      {isPending && <p role="status" className="sr-only">{t("statistics.loading", { defaultValue: "Loading statistics" })}</p>}
      {isError && (
        <Alert variant="destructive">
          <AlertDescription className="flex flex-wrap items-center justify-between gap-2">
            <span>{t("statistics.loadError", { defaultValue: "Unable to refresh statistics. Please try again." })}</span>
            <Button type="button" variant="outline" size="sm" disabled={isFetching} onClick={() => void refetch()}>
              {t("statistics.retry", { defaultValue: "Retry" })}
            </Button>
          </AlertDescription>
        </Alert>
      )}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <StatisticCard
          title={t("activeUsers")}
          icon={Users}
          content={data ? (
            <span className="inline-flex flex-wrap items-baseline gap-2">
              <span>{numberWithCommas(data.users_active)}</span>
              <span className="text-lg font-normal text-muted-foreground">/ {numberWithCommas(data.total_user)}</span>
            </span>
          ) : placeholder}
        />
        <StatisticCard
          title={t("dataUsage")}
          icon={ChartColumn}
          content={data ? formatBytes(data.incoming_bandwidth + data.outgoing_bandwidth) : placeholder}
        />
        <StatisticCard
          title={t("memoryUsage")}
          icon={MemoryStick}
          content={data && memory ? (
            <span className="inline-flex flex-wrap items-baseline gap-2">
              <span>{memory[0]}</span>
              <span className="text-lg font-normal text-muted-foreground">{memory[1]} / {formatBytes(data.mem_total, 1)}</span>
            </span>
          ) : placeholder}
        />
      </div>
    </section>
  );
}

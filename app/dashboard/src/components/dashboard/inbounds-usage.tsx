import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { inboundsUsageOptions } from "@/features/users/inbounds-usage-resource";
import { useQuery } from "@tanstack/react-query";
import dayjs from "dayjs";
import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { fetch } from "service/http";
import { formatBytes } from "utils/formatByte";

export function InboundsUsage() {
  const { t } = useTranslation();
  // Hour-aligned so the query key stays stable between renders.
  const start = useMemo(() => dayjs().utc().subtract(30, "day").format("YYYY-MM-DDTHH:00:00"), []);
  const { data, isError } = useQuery(inboundsUsageOptions(fetch, start));
  // The endpoint is sudo-only; hide the card for everyone else and while there is no traffic yet.
  if (isError || !data?.usages.length) return null;
  return (
    <Card className="mt-4 py-0 shadow-none">
      <CardHeader className="px-6 pt-6">
        <CardTitle className="text-sm font-medium text-muted-foreground">
          {t("statistics.inboundsUsage", { defaultValue: "Inbound traffic share (last 30 days)" })}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4 p-6 pt-2">
        {data.usages.map((usage) => (
          <div key={usage.tag} className="space-y-1.5">
            <div className="flex items-center justify-between gap-3 text-sm">
              <span className="truncate font-medium" dir="ltr">
                {usage.tag}
              </span>
              <span className="shrink-0 tabular-nums text-muted-foreground">
                {formatBytes(usage.total)} · {(usage.ratio * 100).toFixed(1)}%
              </span>
            </div>
            <Progress value={usage.ratio * 100} aria-label={usage.tag} />
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

import { useTranslation } from "react-i18next";
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";
import { formatBytes } from "utils/formatByte";
import { createUsageData } from "./traffic";

export function TrafficChart({ usage, height = 260, hideLegend = false }: { usage: ReturnType<typeof createUsageData>; height?: number; hideLegend?: boolean }) {
  const { t } = useTranslation();
  const data = usage.series.map((value, index) => ({ value, name: usage.labels[index] || String(index + 1) }));
  if (!data.some((entry) => entry.value > 0)) return <p role="status" className="py-12 text-center text-muted-foreground">{t("userDialog.noUsage", { defaultValue: "No usage recorded for this period." })}</p>;
  return <figure aria-label={t("userDialog.usage")} className="min-w-0 space-y-3">
    <div aria-hidden="true"><ResponsiveContainer width="100%" height={height} initialDimension={{ width: 320, height }}>
      <PieChart accessibilityLayer={false}><Pie data={data} dataKey="value" nameKey="name" innerRadius="60%" outerRadius="85%" isAnimationActive={false} stroke="var(--background)">
        {data.map((entry, index) => <Cell key={entry.name + index} fill={usage.colors[index]} />)}
      </Pie><Tooltip formatter={(value) => formatBytes(Number(value))} contentStyle={{ backgroundColor: "var(--popover)", color: "var(--popover-foreground)", border: "1px solid var(--border)" }} /></PieChart>
    </ResponsiveContainer></div>
    {!hideLegend && <figcaption className="text-sm font-medium">{t("userDialog.total")} {usage.total}</figcaption>}
    {!hideLegend && <ul className="space-y-2 text-xs">{data.map((entry, index) => <li key={entry.name + index} className="flex min-w-0 gap-2">
      <span aria-hidden="true" className="mt-1 size-2 shrink-0" style={{ backgroundColor: usage.colors[index] }} />
      <span className="min-w-0 flex-1 break-all">{entry.name}</span><span className="tabular-nums">{formatBytes(entry.value)}</span>
    </li>)}</ul>}
  </figure>;
}

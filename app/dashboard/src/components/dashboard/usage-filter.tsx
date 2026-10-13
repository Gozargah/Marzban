import { useState } from "react";
import dayjs, { ManipulateType } from "dayjs";
import { ApexOptions } from "apexcharts";
import ReactDatePicker from "react-datepicker";
import { useTranslation } from "react-i18next";
import { Calendar } from "lucide-react";
import { FilterUsageType } from "contexts/DashboardContext";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { generateDistinctColors } from "utils/color";
import { formatBytes } from "utils/formatByte";

export type UsageFilterProps = { onChange: (filter: string, query: FilterUsageType) => void; defaultValue: string };
const units: Record<string, ManipulateType> = { h: "hour", d: "day", w: "week", m: "month" };
const ranges = ["7h", "1d", "3d", "1w", "1m", "3m"];
const customRanges = [
  { title: "hours", values: ["1h", "2h", "3h", "6h", "8h", "12h"] },
  { title: "days", values: ["1d", "2d", "3d", "4d", "5d", "6d"] },
  { title: "weeks", values: ["1w", "2w", "3w", "4w"] },
  { title: "months", values: ["1m", "2m", "3m", "6m", "8m"] },
];
export function UsageFilter({ defaultValue, onChange }: UsageFilterProps) {
  const { t, i18n } = useTranslation();
  const [value, setValue] = useState(defaultValue);
  const [open, setOpen] = useState(false);
  const [absolute, setAbsolute] = useState(false);
  const [dates, setDates] = useState<[Date | null, Date | null]>([null, null]);
  const select = (range: string) => {
    setValue(range);
    setOpen(false);
    onChange(range, {
      start: dayjs()
        .utc()
        .subtract(Number(range.slice(0, -1)), units[range.slice(-1)])
        .format("YYYY-MM-DDTHH:00:00"),
    });
  };
  return (
    <div
      className="flex w-full flex-wrap items-center justify-center gap-1"
      role="group"
      aria-label={t("userDialog.usage")}
    >
      {ranges.map((range) => (
        <Button
          key={range}
          type="button"
          size="sm"
          variant={value === range ? "default" : "outline"}
          aria-pressed={value === range}
          onClick={() => select(range)}
        >
          {range}
        </Button>
      ))}
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger
          render={<Button type="button" size="sm" variant={!ranges.includes(value) ? "default" : "outline"} />}
        >
          <Calendar />
          {t("userDialog.custom")}
          {!ranges.includes(value) && value !== "custom" ? ` (${value})` : ""}
        </PopoverTrigger>
        <PopoverContent side="bottom" className="w-96" dir={i18n.dir()}>
          <div className="mb-3 flex gap-2">
            <Button
              type="button"
              size="sm"
              variant={absolute ? "outline" : "default"}
              aria-pressed={!absolute}
              onClick={() => setAbsolute(false)}
            >
              {t("userDialog.relative")}
            </Button>
            <Button
              type="button"
              size="sm"
              variant={absolute ? "default" : "outline"}
              aria-pressed={absolute}
              onClick={() => setAbsolute(true)}
            >
              {t("userDialog.absolute")}
            </Button>
          </div>
          {absolute ? (
            <div className="overflow-x-auto">
              <ReactDatePicker
                locale={i18n.language.toLowerCase()}
                selected={dates[0]}
                startDate={dates[0]}
                endDate={dates[1]}
                selectsRange
                maxDate={new Date()}
                inline
                onChange={(next: [Date | null, Date | null]) => {
                  setDates(next);
                  if (next[0] && next[1]) {
                    setValue("custom");
                    setOpen(false);
                    onChange("custom", {
                      start: dayjs(next[0]).format("YYYY-MM-DDT00:00:00"),
                      end: dayjs(next[1]).format("YYYY-MM-DDT23:59:59"),
                    });
                  }
                }}
              />
            </div>
          ) : (
            <div className="space-y-3">
              {customRanges.map((row) => (
                <div key={row.title}>
                  <p className="mb-1 text-sm text-muted-foreground">{t(`userDialog.${row.title}`)}</p>
                  <div className="flex flex-wrap gap-1">
                    {row.values.map((range) => (
                      <Button
                        key={range}
                        type="button"
                        size="xs"
                        variant={value === range ? "default" : "outline"}
                        aria-pressed={value === range}
                        onClick={() => select(range)}
                      >
                        {range}
                      </Button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </PopoverContent>
      </Popover>
    </div>
  );
}

export function createUsageConfig(
  colorMode: "light" | "dark",
  title: string,
  series: number[] = [],
  labels: string[] = [],
) {
  const total = formatBytes(series.reduce((sum, value) => sum + value, 0));
  const options: ApexOptions = {
    labels,
    chart: { type: "donut", animations: { enabled: false } },
    title: {
      text: `${title}${total}`,
      align: "center",
      style: { fontWeight: 500, color: colorMode === "dark" ? "#fafafa" : "#171717" },
    },
    legend: { position: "bottom", labels: { colors: colorMode === "dark" ? "#fafafa" : "#171717" } },
    stroke: { width: 1 },
    dataLabels: { formatter: (_value, { seriesIndex, w }) => String(formatBytes(w.config.series[seriesIndex], 1)) },
    tooltip: { theme: colorMode, y: { formatter: (value) => String(formatBytes(value, 1)) } },
    colors: generateDistinctColors(series.length),
  };
  return { series, options };
}

import { FC, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { UsagePeriod, useUsageSeries } from "./api";
import { Blueprint } from "./Blueprint";
import { bucketLabel, formatAverageSpeed, seriesFormatter } from "./format";

const PERIODS: UsagePeriod[] = ["24h", "7d", "30d"];
/** The chart is drawn in this fixed user space and stretched to the panel. */
const VIEW_W = 752;
const VIEW_H = 190;

type Point = { time: string; down: number; up: number };

/** Builds the line and area paths for one series. */
const buildPaths = (points: Point[], axisMax: number) => {
  if (points.length === 0) return { areaDown: "", lineDown: "", lineUp: "" };

  const x = (index: number) => (points.length === 1 ? VIEW_W / 2 : (index / (points.length - 1)) * VIEW_W);
  const y = (value: number) => VIEW_H - (axisMax > 0 ? (value / axisMax) * VIEW_H : 0);

  const line = (pick: (p: Point) => number) =>
    points.map((point, index) => `${index === 0 ? "M" : "L"}${x(index).toFixed(2)} ${y(pick(point)).toFixed(2)}`).join(" ");

  const lineDown = line((p) => p.down);
  return {
    lineDown,
    lineUp: line((p) => p.up),
    areaDown: `${lineDown} L${VIEW_W} ${VIEW_H} L0 ${VIEW_H} Z`,
  };
};

/** Which bucket labels to print: every 4 hours, every day, every 5 days. */
const labelStride = (period: UsagePeriod) => (period === "24h" ? 4 : period === "7d" ? 1 : 5);

type TrafficChartProps = {
  /** Taller plot for the dedicated Traffic page. */
  height?: number;
};

export const TrafficChart: FC<TrafficChartProps> = ({ height = VIEW_H }) => {
  const { t } = useTranslation();
  const [period, setPeriod] = useState<UsagePeriod>("24h");
  const { data, isLoading } = useUsageSeries(period);

  const points: Point[] = useMemo(
    () => (data?.points || []).map((p) => ({ time: p.time, down: p.downlink, up: p.uplink })),
    [data],
  );

  const granularity = data?.granularity || "hour";
  const peak = points.reduce((max, p) => Math.max(max, p.down + p.up), 0);
  const total = points.reduce((sum, p) => sum + p.down + p.up, 0);
  const axisMax = peak * 1.12;
  const units = seriesFormatter(peak);
  const { areaDown, lineDown, lineUp } = buildPaths(points, axisMax);

  const seconds = period === "24h" ? 24 * 3600 : period === "7d" ? 7 * 86400 : 30 * 86400;
  const stride = labelStride(period);
  const caption = t(`xenith.chart.caption.${period}`);

  return (
    <Blueprint style={{ padding: 20, display: "flex", flexDirection: "column", gap: 16 }}>
      <div style={{ display: "flex", alignItems: "flex-start", gap: 16, flexWrap: "wrap" }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 3, marginRight: "auto" }}>
          <h2 className="xn-panel-title">{t("xenith.chart.title")}</h2>
          <span style={{ fontSize: 11.5, color: "var(--xn-neutral-600)" }}>{caption}</span>
        </div>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 14,
            fontSize: 11,
            letterSpacing: "0.08em",
            textTransform: "uppercase",
            color: "var(--xn-neutral-600)",
          }}
        >
          <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <i style={{ width: 9, height: 9, background: "var(--xn-accent)", display: "block" }} />
            {t("xenith.chart.download")}
          </span>
          <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <i style={{ width: 9, height: 9, background: "var(--xn-accent-300)", display: "block" }} />
            {t("xenith.chart.upload")}
          </span>
        </div>
        <div className="xn-seg">
          {PERIODS.map((option) => (
            <button
              key={option}
              className="xn-seg-opt"
              style={{ fontSize: 12 }}
              aria-pressed={option === period}
              onClick={() => setPeriod(option)}
            >
              {t(`xenith.chart.range.${option}`)}
            </button>
          ))}
        </div>
      </div>

      <div style={{ display: "flex", gap: 12 }}>
        <div
          className="xn-mono"
          style={{
            display: "flex",
            flexDirection: "column",
            justifyContent: "space-between",
            alignItems: "flex-end",
            height: height + 18,
            fontSize: 10,
            color: "var(--xn-neutral-500)",
            paddingBottom: 18,
          }}
        >
          <span>{units.formatWithUnit(axisMax)}</span>
          <span>{units.format(axisMax / 2)}</span>
          <span>0</span>
        </div>

        <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: 6 }}>
          <div
            style={{
              position: "relative",
              height,
              borderLeft: "1px solid var(--xn-divider)",
              borderBottom: "1px solid var(--xn-divider)",
            }}
          >
            <div
              style={{
                position: "absolute",
                inset: 0,
                backgroundImage:
                  "repeating-linear-gradient(to bottom, var(--xn-neutral-200) 0 1px, transparent 1px 47.5px)",
              }}
            />
            {points.length > 0 && (
              <svg
                viewBox={`0 0 ${VIEW_W} ${VIEW_H}`}
                preserveAspectRatio="none"
                width="100%"
                height={height}
                style={{ position: "absolute", inset: 0, display: "block" }}
              >
                <path d={areaDown} fill="var(--xn-accent-300)" fillOpacity="0.55" />
                <path d={lineDown} fill="none" stroke="var(--xn-accent)" strokeWidth="2" vectorEffect="non-scaling-stroke" />
                <path
                  d={lineUp}
                  fill="none"
                  stroke="var(--xn-accent-600)"
                  strokeWidth="1.25"
                  strokeDasharray="4 3"
                  vectorEffect="non-scaling-stroke"
                />
              </svg>
            )}
            {points.length === 0 && (
              <div
                style={{
                  position: "absolute",
                  inset: 0,
                  display: "grid",
                  placeItems: "center",
                  fontSize: 12,
                  color: "var(--xn-neutral-600)",
                }}
              >
                {isLoading ? t("xenith.loading") : t("xenith.chart.empty")}
              </div>
            )}
          </div>

          <div
            className="xn-mono"
            style={{ display: "flex", justifyContent: "space-between", fontSize: 10, color: "var(--xn-neutral-500)" }}
          >
            {points
              .filter((_, index) => index % stride === 0)
              .map((point) => (
                <span key={point.time}>{bucketLabel(point.time, granularity)}</span>
              ))}
          </div>
        </div>
      </div>

      <div
        className="xn-grid-cells"
        style={{ gridTemplateColumns: "repeat(3, 1fr)", border: 0, borderTop: "1px solid var(--xn-divider)", paddingTop: 1 }}
      >
        {[
          { label: t("xenith.chart.peak"), value: units.formatWithUnit(peak) },
          { label: t("xenith.chart.total"), value: units.formatWithUnit(total) },
          { label: t("xenith.chart.average"), value: formatAverageSpeed(total, seconds) },
        ].map((metric, index) => (
          <div
            key={metric.label}
            className="xn-cell"
            style={{
              padding: index === 0 ? "12px 2px 0" : "12px 2px 0 14px",
              display: "flex",
              flexDirection: "column",
              gap: 2,
            }}
          >
            <span
              style={{ fontSize: 10, letterSpacing: "0.12em", textTransform: "uppercase", color: "var(--xn-neutral-600)" }}
            >
              {metric.label}
            </span>
            <span className="xn-heading" style={{ fontSize: 22, lineHeight: 1 }}>
              {metric.value}
            </span>
          </div>
        ))}
      </div>
    </Blueprint>
  );
};

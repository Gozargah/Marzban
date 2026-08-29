/**
 * Formatting rules taken from the design handoff: TB with one decimal, GB as
 * whole numbers, thousands split by a narrow no-break space, and one unit per
 * screen so "2325 GB" never sits next to "3.9 TB".
 */

const NARROW_SPACE = " ";

const KB = 1024;
const MB = KB * 1024;
const GB = MB * 1024;
const TB = GB * 1024;

/** Thousands separated by a narrow space: 1284 -> "1 284". */
export const groupDigits = (value: number): string =>
  Math.round(value).toString().replace(/\B(?=(\d{3})+(?!\d))/g, NARROW_SPACE);

export type Measure = { value: string; unit: string };

/** Splits bytes into a rounded number and its unit, so the two can be typeset apart. */
export const measureBytes = (bytes: number): Measure => {
  if (!bytes || bytes < 0) return { value: "0", unit: "B" };
  if (bytes >= TB) return { value: (bytes / TB).toFixed(1), unit: "TB" };
  if (bytes >= GB) return { value: groupDigits(bytes / GB), unit: "GB" };
  if (bytes >= MB) return { value: groupDigits(bytes / MB), unit: "MB" };
  if (bytes >= KB) return { value: groupDigits(bytes / KB), unit: "KB" };
  return { value: groupDigits(bytes), unit: "B" };
};

export const formatBytes = (bytes: number): string => {
  const { value, unit } = measureBytes(bytes);
  return `${value} ${unit}`;
};

/**
 * Bytes on one axis or series, all rendered in the same unit so the numbers
 * stay comparable. Hourly values read as whole GB until they pass 1000, at
 * which point the whole series moves to TB with two decimals.
 */
export const seriesFormatter = (peakBytes: number) => {
  const useTB = peakBytes >= 1000 * GB;
  const unit = useTB ? "TB" : "GB";
  const divisor = useTB ? TB : GB;
  const decimals = useTB ? 2 : 0;
  return {
    unit,
    format: (bytes: number) => (bytes / divisor).toFixed(decimals),
    formatWithUnit: (bytes: number) => `${(bytes / divisor).toFixed(decimals)} ${unit}`,
  };
};

/** Average throughput over a period, in whole Mbit/s. */
export const formatAverageSpeed = (bytes: number, seconds: number): string => {
  if (!seconds) return "0 Mbit/s";
  const mbits = (bytes * 8) / seconds / 1_000_000;
  return `${groupDigits(mbits)} Mbit/s`;
};

/** Uptime as the panel writes it elsewhere: "18d 04:11". */
export const formatUptime = (startedAt: Date | null): string => {
  if (!startedAt) return "—";
  const total = Math.max(0, Math.floor((Date.now() - startedAt.getTime()) / 1000));
  const days = Math.floor(total / 86400);
  const hours = String(Math.floor((total % 86400) / 3600)).padStart(2, "0");
  const minutes = String(Math.floor((total % 3600) / 60)).padStart(2, "0");
  return days ? `${days}d ${hours}:${minutes}` : `${hours}:${minutes}`;
};

export const formatPercent = (part: number, whole: number): number =>
  whole > 0 ? Math.min(100, Math.round((part / whole) * 100)) : 0;

/** Axis label for a bucket: hours for the 24h range, day/month otherwise. */
export const bucketLabel = (time: string, granularity: "hour" | "day"): string => {
  const date = new Date(time);
  if (granularity === "hour") {
    return `${String(date.getHours()).padStart(2, "0")}:00`;
  }
  return `${String(date.getDate()).padStart(2, "0")}.${String(date.getMonth() + 1).padStart(2, "0")}`;
};

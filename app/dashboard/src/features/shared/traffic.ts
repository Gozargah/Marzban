import { generateDistinctColors } from "utils/color";
import { formatBytes } from "utils/formatByte";
export function createUsageData(series: number[] = [], labels: string[] = []) {
  return { series, labels, colors: generateDistinctColors(series.length), total: formatBytes(series.reduce((sum, value) => sum + value, 0)) };
}

import { queryOptions } from "@tanstack/react-query";
import { queryKeys } from "../shared/query-keys";
import type { Transport } from "../shared/transport";

export type InboundUsage = { tag: string; uplink: number; downlink: number; total: number; ratio: number };
export type InboundsUsage = { usages: InboundUsage[] };

export function inboundsUsageOptions(request: Transport, start: string) {
  return queryOptions({
    queryKey: queryKeys.inboundsUsage(start),
    queryFn: ({ signal }) => request<InboundsUsage>("/inbounds/usage", { signal, query: { start }, retry: 0 }),
    staleTime: 60_000,
    retry: false,
    refetchOnWindowFocus: false,
  });
}

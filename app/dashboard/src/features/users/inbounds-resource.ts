import { queryOptions } from "@tanstack/react-query";
import type { InboundType, ProtocolType } from "@/contexts/dashboard-context";
import type { Transport } from "../shared/transport";
import { queryKeys } from "../shared/query-keys";
export function inboundsOptions(request: Transport) {
  return queryOptions({
    queryKey: queryKeys.inbounds,
    queryFn: ({ signal }) => request<Record<ProtocolType, InboundType[]>>("/inbounds", { signal, retry: 0 }),
    staleTime: 30_000, retry: false, refetchOnWindowFocus: false,
  });
}

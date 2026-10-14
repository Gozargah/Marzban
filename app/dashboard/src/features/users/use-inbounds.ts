import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { fetch } from "service/http";
import type { Inbounds } from "@/contexts/dashboard-context";
import { inboundsOptions } from "./inbounds-resource";
export function useInbounds() {
  const query = useQuery(inboundsOptions(fetch));
  const inbounds = useMemo(() => new Map(Object.entries(query.data ?? {})) as Inbounds, [query.data]);
  return { inbounds, loading: query.isFetching || query.isPaused, failed: query.isError, retry: async () => { await query.refetch(); } };
}

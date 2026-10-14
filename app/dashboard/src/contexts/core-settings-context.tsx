import { queryKeys } from "@/features/shared/query-keys";
import { useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { fetch } from "service/http";
import { createCoreResource } from "@/features/core/resource";
export function useCoreSettings(open: boolean) {
  const client = useQueryClient();
  const resource = createCoreResource(client, fetch, () => client.invalidateQueries({ queryKey: queryKeys.inbounds }));
  const query = useQuery({ ...resource.options(), enabled: open });
  const saving = useMutation({ mutationFn: resource.save, retry: false });
  const restarting = useMutation({ mutationFn: resource.restart, retry: false });
  useEffect(() => { if (!open) void client.cancelQueries({ queryKey: queryKeys.core }); }, [open, client]);
  return { config: query.data?.config ?? "", version: query.data?.version ?? null, isLoading: query.isPending,
    isRefreshing: query.isFetching, isError: query.isError, updatedAt: query.dataUpdatedAt, offline: query.isPaused,
    isPostLoading: saving.isPending, updateConfig: saving.mutateAsync, restartCore: restarting.mutateAsync,
    fetchCoreSettings: async () => { const result = await query.refetch(); if (result.error) throw result.error; },
  };
}

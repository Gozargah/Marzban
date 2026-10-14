import { queryKeys } from "@/features/shared/query-keys";
import { useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { fetch } from "service/http";
import { createHostsResource } from "@/features/hosts/resource";
const emptyHosts = {};
export function useHostsSettings(open: boolean) {
  const client = useQueryClient();
  const resource = createHostsResource(client, fetch);
  const query = useQuery({ ...resource.options(), enabled: open });
  const mutation = useMutation({ mutationFn: resource.save, retry: false });
  useEffect(() => { if (!open) void client.cancelQueries({ queryKey: queryKeys.hosts }); }, [open, client]);
  return { hosts: query.data ?? emptyHosts, isLoading: query.isPending, isRefreshing: query.isFetching, isError: query.isError,
    updatedAt: query.dataUpdatedAt, offline: query.isPaused, isPostLoading: mutation.isPending, setHosts: mutation.mutateAsync,
    fetchHosts: async () => { const result = await query.refetch(); if (result.error) throw result.error; },
  };
}

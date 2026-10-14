import { queryOptions, type QueryClient } from "@tanstack/react-query";
import { queryKeys } from "../shared/query-keys";
import type { Transport } from "../shared/transport";

export type Hosts = Record<string, { remark: string; address: string; port: number | null; path: string | null; sni: string | null; host: string | null }[]>;
export function createHostsResource(client: QueryClient, request: Transport) {
  return {
    options: () => queryOptions({ queryKey: queryKeys.hosts, queryFn: ({ signal }) => request<Hosts>("/hosts", { signal, retry: 0 }), staleTime: 30_000, retry: false, refetchOnWindowFocus: false }),
    cancel: () => client.cancelQueries({ queryKey: queryKeys.hosts }),
    async save(body: Hosts) {
      await client.cancelQueries({ queryKey: queryKeys.hosts });
      await request("/hosts", { method: "PUT", body, retry: 0 });
      client.setQueryData(queryKeys.hosts, body);
      await client.invalidateQueries({ queryKey: queryKeys.users });
    },
  };
}

import { queryOptions, type QueryClient } from "@tanstack/react-query";
import { queryKeys } from "../shared/query-keys";
import type { Transport } from "../shared/transport";

export type HostTlsExtra = {
  ech_config_list?: string | null;
  ech_force_query?: string | null;
  pinned_peer_cert_sha256?: string[];
  verify_peer_cert_by_name?: string[];
};
export type HostRealityExtra = { public_key?: string; short_id?: string; spider_x?: string | null };
export type HostXhttpExtra = {
  mode?: string | null;
  x_padding_bytes?: string | null;
  sc_max_each_post_bytes?: string | null;
  xmux?: Record<string, string | number | null> | null;
};
export type HostMuxSettings = {
  enabled?: boolean;
  concurrency?: number | null;
  xudp_concurrency?: number | null;
  xudp_proxy_udp443?: string | null;
};
export type Hosts = Record<
  string,
  {
    remark: string;
    address: string;
    port: number | null;
    path: string | null;
    sni: string | null;
    host: string | null;
    tls_extra?: HostTlsExtra | null;
    reality_extra?: HostRealityExtra | null;
    xhttp_extra?: HostXhttpExtra | null;
    mux_settings?: HostMuxSettings | null;
  }[]
>;
export function createHostsResource(client: QueryClient, request: Transport) {
  return {
    options: () =>
      queryOptions({
        queryKey: queryKeys.hosts,
        queryFn: ({ signal }) => request<Hosts>("/hosts", { signal, retry: 0 }),
        staleTime: 30_000,
        retry: false,
        refetchOnWindowFocus: false,
      }),
    cancel: () => client.cancelQueries({ queryKey: queryKeys.hosts }),
    async save(body: Hosts) {
      await client.cancelQueries({ queryKey: queryKeys.hosts });
      await request("/hosts", { method: "PUT", body, retry: 0 });
      client.setQueryData(queryKeys.hosts, body);
      await client.invalidateQueries({ queryKey: queryKeys.users });
    },
  };
}

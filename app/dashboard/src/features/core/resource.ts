import { parseCoreConfig } from "./config";
import { queryOptions, type QueryClient } from "@tanstack/react-query";
import { queryKeys } from "../shared/query-keys";
import type { Transport } from "../shared/transport";
export type CoreSettings = { version: string | null; started: boolean; logs_websocket: string | null; config: string };
export function createCoreResource(client: QueryClient, request: Transport, refreshInbounds: () => Promise<unknown>) {
  return {
    options: () => queryOptions({
      queryKey: queryKeys.core, staleTime: 30_000, retry: false, refetchOnWindowFocus: false,
      queryFn: async ({ signal }): Promise<CoreSettings> => {
        const controller = new AbortController();
        const abort = () => controller.abort();
        signal.addEventListener("abort", abort, { once: true });
        if (signal.aborted) controller.abort();
        try {
          const [info, config] = await Promise.all([
            request<Omit<CoreSettings, "config">>("/core", { signal: controller.signal, retry: 0 }),
            request<unknown>("/core/config", { signal: controller.signal, retry: 0 }),
          ]);
          return { ...info, config: JSON.stringify(config, null, 2) };
        } finally { controller.abort(); signal.removeEventListener("abort", abort); }
      },
    }),
    cancel: () => client.cancelQueries({ queryKey: queryKeys.core }),
    async save(json: string) {
      const body = parseCoreConfig(json);
      await client.cancelQueries({ queryKey: queryKeys.core });
      await request("/core/config", { method: "PUT", body, retry: 0 });
      client.setQueryData<CoreSettings>(queryKeys.core, (previous) => previous ? { ...previous, config: JSON.stringify(body, null, 2) } : undefined);
      await Promise.all([
        client.invalidateQueries({ queryKey: queryKeys.users }),
        client.invalidateQueries({ queryKey: queryKeys.statistics }),
        refreshInbounds().catch(() => undefined),
      ]);
    },
    async restart() {
      const result = await request("/core/restart", { method: "POST", retry: 0 });
      await Promise.all([
        client.invalidateQueries({ queryKey: queryKeys.core }),
        client.invalidateQueries({ queryKey: queryKeys.statistics }),
      ]);
      return result;
    },
  };
}

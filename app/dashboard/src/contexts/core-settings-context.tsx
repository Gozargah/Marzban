import { fetchInbounds } from "@/contexts/dashboard-context";
import { fetch } from "service/http";
import { create } from "zustand";
import { createLatestRequest } from "utils/latest-request";

type CoreSettingsStore = {
  isLoading: boolean;
  isPostLoading: boolean;
  fetchCoreSettings: () => Promise<void>;
  cancelFetch: () => void;
  updateConfig: (json: string) => Promise<void>;
  restartCore: () => Promise<void>;
  version: string | null;
  started: boolean | null;
  logs_websocket: string | null;
  config: string;
};

const requestOwner = createLatestRequest();

export const useCoreSettings = create<CoreSettingsStore>((set) => ({
  isLoading: true,
  isPostLoading: false,
  version: null,
  started: false,
  logs_websocket: null,
  config: "",
  cancelFetch: () => {
    requestOwner.cancel();
    set({ isLoading: false });
  },
  fetchCoreSettings: async () => {
    const request = requestOwner.start();
    set({ isLoading: true });
    try {
      const [core, config] = await Promise.all([
        fetch<Pick<CoreSettingsStore, "version" | "started" | "logs_websocket">>("/core", { signal: request.signal, retry: 0 }),
        fetch("/core/config", { signal: request.signal, retry: 0 }),
      ]);
      if (request.isCurrent()) set({ ...core, config: JSON.stringify(config, null, 2) });
    } catch (error) {
      if (request.isCurrent()) throw error;
    } finally {
      // Also abort a remaining sibling if one of the parallel reads failed.
      if (request.isCurrent()) {
        requestOwner.cancel();
        set({ isLoading: false });
      }
      request.finish();
    }
  },
  updateConfig: async (body) => {
    const payload = JSON.parse(body);
    requestOwner.cancel();
    set({ isPostLoading: true, isLoading: false });
    return fetch("/core/config", { method: "PUT", body: payload })
      .then(() => {
        set({ config: JSON.stringify(payload, null, 2) });
        return fetchInbounds().catch(() => undefined);
      })
      .finally(() => {
        set({ isPostLoading: false });
      });
  },
  restartCore: () => {
    return fetch("/core/restart", { method: "POST" });
  },
}));

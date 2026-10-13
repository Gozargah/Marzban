import { fetch } from "service/http";
import { create } from "zustand";
import { createLatestRequest } from "utils/latest-request";

type HostsSchema = Record<
  string,
  {
    remark: string;
    address: string;
    port: number | null;
    path: string | null;
    sni: string | null;
    host: string | null;
  }[]
>;

type HostsStore = {
  isLoading: boolean;
  isPostLoading: boolean;
  hosts: HostsSchema;
  fetchHosts: () => Promise<void>;
  cancelFetch: () => void;
  setHosts: (hosts: HostsSchema) => Promise<void>;
};
const requestOwner = createLatestRequest();

export const useHosts = create<HostsStore>((set) => ({
  isLoading: false,
  isPostLoading: false,
  hosts: {},
  cancelFetch: () => {
    requestOwner.cancel();
    set({ isLoading: false });
  },
  fetchHosts: async () => {
    const request = requestOwner.start();
    set({ isLoading: true });
    try {
      const hosts = await fetch<HostsSchema>("/hosts", { signal: request.signal, retry: 0 });
      if (request.isCurrent()) set({ hosts });
    } catch (error) {
      if (request.isCurrent()) throw error;
    } finally {
      if (request.isCurrent()) set({ isLoading: false });
      request.finish();
    }
  },
  setHosts: (body) => {
    requestOwner.cancel();
    set({ isPostLoading: true, isLoading: false });
    return fetch("/hosts", { method: "PUT", body }).then(() => {
      set({ hosts: body });
    }).finally(() => {
      set({ isPostLoading: false });
    });
  },
}));
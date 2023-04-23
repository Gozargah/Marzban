import { fetch } from "service/http";
import { create } from "zustand";

type NodesSchema = Record<
  string,
  {
    remark: string;
    address: string;
    port: number | null;
    sni: string | null;
    host: string | null;
  }[]
>;

type HostsStore = {
  isLoading: boolean;
  isPostLoading: boolean;
  nodes: NodesSchema;
  // fetchHosts: () => void;
  // setHosts: (hosts: NodesSchema) => Promise<void>;
};
export const useHosts = create<HostsStore>((set) => ({
  isLoading: false,
  isPostLoading: false,
  nodes: {},
  // fetchHosts: () => {
  //   set({ isLoading: true });
  //   fetch("/hosts")
  //     .then((hosts) => set({ hosts }))
  //     .finally(() => set({ isLoading: false }));
  // },
  // setHosts: (body) => {
  //   set({ isPostLoading: true });
  //   return fetch("/hosts", { method: "PUT", body }).finally(() => {
  //     set({ isPostLoading: false });
  //   });
  // },
}));
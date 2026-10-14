import { router } from "@/pages/router";
import { fetch } from "service/http";
import { User, UserCreate } from "types/User";
import { usersResource } from "@/features/users/api";
import { getUsersPerPageLimitSize } from "utils/userPreferenceStorage";
import { create } from "zustand";
import { subscribeWithSelector } from "zustand/middleware";

export type FilterType = {
  limit?: number;
  offset?: number;
  search?: string;
  sort: string;
  status?: "active" | "disabled" | "limited" | "expired" | "on_hold";
};
export type ProtocolType = "vmess" | "vless" | "trojan" | "shadowsocks";

export type FilterUsageType = {
  start?: string;
  end?: string;
};

export type InboundType = {
  tag: string;
  protocol: ProtocolType;
  network: string;
  tls: string;
  port?: number;
};
export type Inbounds = Map<ProtocolType, InboundType[]>;

type DashboardStateType = {
  isCreatingNewUser: boolean;
  editingUser: User | null | undefined;
  deletingUser: User | null;
  filters: FilterType;
  subscribeUrl: string | null;
  QRcodeLinks: string[] | null;
  isEditingHosts: boolean;
  isEditingNodes: boolean;
  isShowingNodesUsage: boolean;
  isResetingAllUsage: boolean;
  resetUsageUser: User | null;
  revokeSubscriptionUser: User | null;
  isEditingCore: boolean;
  onCreateUser: (isOpen: boolean) => void;
  onEditingUser: (user: User | null) => void;
  onDeletingUser: (user: User | null) => void;
  onResetAllUsage: (isResetingAllUsage: boolean) => void;
  refetchUsers: () => void;
  resetAllUsage: () => Promise<void>;
  onFilterChange: (filters: Partial<FilterType>, pushState?: boolean) => void;
  deleteUser: (user: User) => Promise<void>;
  createUser: (user: UserCreate) => Promise<void>;
  editUser: (user: UserCreate) => Promise<void>;
  fetchUserUsage: (user: User, query: FilterUsageType, signal?: AbortSignal) => Promise<void>;
  setQRCode: (links: string[] | null) => void;
  setSubLink: (subscribeURL: string | null) => void;
  onEditingHosts: (isEditingHosts: boolean) => void;
  onEditingNodes: (isEditingHosts: boolean) => void;
  onShowingNodesUsage: (isShowingNodesUsage: boolean) => void;
  resetDataUsage: (user: User) => Promise<void>;
  revokeSubscription: (user: User) => Promise<void>;
};

export const cancelUsersRequest = () => { void usersResource.cancel(); };

const serializeFilters = (f: Partial<FilterType>) => {
  const filters = { ...f };
  delete filters.limit;
  if (filters.sort === "-created_at") delete filters.sort;

  const parsedFilters = Object.keys(filters).reduce(
    (acc, key) => {
      const value = filters[key as keyof FilterType];
      if (value) {
        acc[key] = String(value);
      }
      return acc;
    },
    {} as Record<string, string>,
  );

  router.navigate(`/?${new URLSearchParams(parsedFilters).toString()}`, { replace: false });
};

export const useDashboard = create(
  subscribeWithSelector<DashboardStateType>((set, get) => ({
    editingUser: null,
    deletingUser: null,
    isCreatingNewUser: false,
    QRcodeLinks: null,
    subscribeUrl: null,
    isResetingAllUsage: false,
    isEditingHosts: false,
    isEditingNodes: false,
    isShowingNodesUsage: false,
    resetUsageUser: null,
    revokeSubscriptionUser: null,
    filters: {
      limit: getUsersPerPageLimitSize(),
      sort: "-created_at",
    },
    isEditingCore: false,
    refetchUsers: () => { void usersResource.refresh(); },
    resetAllUsage: async () => {
      await usersResource.resetAll();
      get().onResetAllUsage(false);
    },
    onResetAllUsage: (isResetingAllUsage) => set({ isResetingAllUsage }),
    onCreateUser: (isCreatingNewUser) => set({ isCreatingNewUser }),
    onEditingUser: (editingUser) => {
      set({ editingUser });
    },
    onDeletingUser: (deletingUser) => {
      set({ deletingUser });
    },
    onFilterChange: (filters, pushState = true) => {
      const allFilters = {
        ...get().filters,
        ...filters,
      };
      const changed = Object.keys(allFilters).some((key) =>
        allFilters[key as keyof FilterType] !== get().filters[key as keyof FilterType]);
      if (changed) set({ filters: allFilters });
      if (pushState && changed) serializeFilters(allFilters);
      if (!changed) get().refetchUsers();
    },
    setQRCode: (QRcodeLinks) => {
      set({ QRcodeLinks });
    },
    deleteUser: async (user) => {
      await usersResource.delete(user);
      set({ editingUser: null, deletingUser: null });
    },
    createUser: async (body) => {
      await usersResource.create(body);
      set({ editingUser: null });
    },
    editUser: async (body) => {
      await usersResource.edit(body);
      set({ editingUser: null });
    },
    fetchUserUsage: (body: User, query: FilterUsageType, signal?: AbortSignal) => {
      return fetch(`/user/${body.username}/usage`, { method: "GET", query, signal });
    },
    onEditingHosts: (isEditingHosts: boolean) => {
      set({ isEditingHosts });
    },
    onEditingNodes: (isEditingNodes: boolean) => {
      set({ isEditingNodes });
    },
    onShowingNodesUsage: (isShowingNodesUsage: boolean) => {
      set({ isShowingNodesUsage });
    },
    setSubLink: (subscribeUrl) => {
      set({ subscribeUrl });
    },
    resetDataUsage: async (user) => {
      await usersResource.reset(user);
      set({ resetUsageUser: null });
    },
    revokeSubscription: async (user) => {
      const updated = await usersResource.revoke(user);
      set({ revokeSubscriptionUser: null, editingUser: updated });
    },
  })),
);

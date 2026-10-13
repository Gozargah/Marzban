import { router } from "@/pages/router";
import { StatisticsQueryKey } from "@/components/dashboard/statistics";
import { createLatestRequest } from "utils/latest-request";
import { fetch } from "service/http";
import { User, UserCreate } from "types/User";
import { queryClient } from "utils/react-query";
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
  version: string | null;
  users: {
    users: User[];
    total: number;
  };
  inbounds: Inbounds;
  loading: boolean;
  usersError: boolean;
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

const usersRequest = createLatestRequest();
export const cancelUsersRequest = () => {
  usersRequest.cancel();
  useDashboard.setState({ loading: false });
};

const fetchUsers = async (filters: FilterType): Promise<void> => {
  const request = usersRequest.start();
  // Never mutate the store's filters while normalizing HTTP query parameters.
  const query = Object.fromEntries(Object.entries(filters).filter(([, value]) =>
    value !== undefined && value !== null && value !== ""));
  useDashboard.setState({ loading: true, usersError: false });
  try {
    const users = await fetch<DashboardStateType["users"]>("/users", { query, signal: request.signal, retry: 0 });
    if (request.isCurrent()) useDashboard.setState({ users });
  } catch {
    if (request.isCurrent()) useDashboard.setState({ usersError: true });
  } finally {
    if (request.isCurrent()) useDashboard.setState({ loading: false });
    request.finish();
  }
};

export const fetchInbounds = async (signal?: AbortSignal) => {
  const inbounds = await fetch<Record<ProtocolType, InboundType[]>>("/inbounds", { signal, retry: 0 });
  if (!signal?.aborted) useDashboard.setState({ inbounds: new Map(Object.entries(inbounds)) as Inbounds });
};

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
    version: null,
    editingUser: null,
    deletingUser: null,
    isCreatingNewUser: false,
    QRcodeLinks: null,
    subscribeUrl: null,
    users: {
      users: [],
      total: 0,
    },
    loading: true,
    usersError: false,
    isResetingAllUsage: false,
    isEditingHosts: false,
    isEditingNodes: false,
    isShowingNodesUsage: false,
    resetUsageUser: null,
    revokeSubscriptionUser: null,
    filters: {
      username: "",
      limit: getUsersPerPageLimitSize(),
      sort: "-created_at",
    },
    inbounds: new Map(),
    isEditingCore: false,
    refetchUsers: () => {
      void fetchUsers(get().filters);
    },
    resetAllUsage: () => {
      return fetch(`/users/reset`, { method: "POST" }).then(() => {
        get().onResetAllUsage(false);
        get().refetchUsers();
      });
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
      get().refetchUsers();
    },
    setQRCode: (QRcodeLinks) => {
      set({ QRcodeLinks });
    },
    deleteUser: (user: User) => {
      set({ editingUser: null });
      return fetch(`/user/${user.username}`, { method: "DELETE" }).then(() => {
        set({ deletingUser: null });
        get().refetchUsers();
        queryClient.invalidateQueries({ queryKey: [StatisticsQueryKey] });
      });
    },
    createUser: (body: UserCreate) => {
      return fetch(`/user`, { method: "POST", body }).then(() => {
        set({ editingUser: null });
        get().refetchUsers();
        queryClient.invalidateQueries({ queryKey: [StatisticsQueryKey] });
      });
    },
    editUser: (body: UserCreate) => {
      return fetch(`/user/${body.username}`, { method: "PUT", body }).then(() => {
        get().onEditingUser(null);
        get().refetchUsers();
      });
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
    resetDataUsage: (user) => {
      return fetch(`/user/${user.username}/reset`, { method: "POST" }).then(() => {
        set({ resetUsageUser: null });
        get().refetchUsers();
      });
    },
    revokeSubscription: (user) => {
      return fetch(`/user/${user.username}/revoke_sub`, {
        method: "POST",
      }).then((user) => {
        set({ revokeSubscriptionUser: null, editingUser: user });
        get().refetchUsers();
      });
    },
  })),
);

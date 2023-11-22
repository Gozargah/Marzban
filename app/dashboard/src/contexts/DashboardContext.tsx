import { NodeType } from "contexts/NodesContext";
import {
  UserResponse,
  getGetSystemStatsQueryKey,
  getGetUsersQueryKey,
} from "service/api";
import { fetch } from "service/http";
import { User, UserCreate } from "types/User";
import { queryClient } from "utils/react-query";
import { getUsersPerPageLimitSize } from "utils/userPreferenceStorage";
import { create } from "zustand";
import { subscribeWithSelector } from "zustand/middleware";

export type FilterType = {
  username?: string;
  limit?: number;
  offset?: number;
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
  editingUser: Required<UserResponse> | null | undefined;
  deletingUser: Required<UserResponse> | null;
  version: string | null;
  users: {
    users: User[];
    total: number;
  };
  loading: boolean;
  filters: FilterType;
  subscribeUrl: string | null;
  QRcodeLinks: string[] | null;
  isEditingHosts: boolean;
  isEditingNodes: boolean;
  isShowingNodesUsage: boolean;
  isResetingAllUsage: boolean;
  resetUsageUser: Required<UserResponse> | null;
  revokeSubscriptionUser: Required<UserResponse> | null;
  isEditingCore: boolean;
  deletingNode?: NodeType | null;
  onResetAllUsage: (isResetingAllUsage: boolean) => void;
  setDeletingNode: (node: NodeType | null) => void;
  onCreateUser: (isOpen: boolean) => void;
  onEditingUser: (user: Required<UserResponse> | null) => void;
  onDeletingUser: (user: Required<UserResponse> | null) => void;
  refetchUsers: () => void;
  onFilterChange: (filters: Partial<FilterType>) => void;
  deleteUser: (user: Required<UserResponse>) => Promise<void>;
  createUser: (user: UserCreate) => Promise<void>;
  editUser: (user: UserCreate) => Promise<void>;
  fetchUserUsage: (
    user: Required<UserResponse>,
    query: FilterUsageType
  ) => Promise<void>;
  setQRCode: (links: string[] | null) => void;
  setSubLink: (subscribeURL: string | null) => void;
  onEditingHosts: (isEditingHosts: boolean) => void;
  onEditingNodes: (isEditingHosts: boolean) => void;
  onShowingNodesUsage: (isShowingNodesUsage: boolean) => void;
  revokeSubscription: (user: Required<UserResponse>) => Promise<void>;
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
    isEditingCore: false,
    refetchUsers: () => {
      queryClient.invalidateQueries(getGetUsersQueryKey());
    },

    setDeletingNode(node) {
      set({ deletingNode: node });
    },
    onCreateUser: (isCreatingNewUser) => set({ isCreatingNewUser }),
    onEditingUser: (editingUser) => {
      set({ editingUser });
    },
    onResetAllUsage: (isResetingAllUsage) => set({ isResetingAllUsage }),
    onDeletingUser: (deletingUser) => {
      set({ deletingUser });
    },
    onFilterChange: (filters) => {
      set({
        filters: {
          ...get().filters,
          ...filters,
        },
      });
      get().refetchUsers();
    },
    setQRCode: (QRcodeLinks) => {
      set({ QRcodeLinks });
    },
    deleteUser: (user: Required<UserResponse>) => {
      set({ editingUser: null });
      return fetch(`/user/${user.username}`, { method: "DELETE" }).then(() => {
        set({ deletingUser: null });
        get().refetchUsers();
        queryClient.invalidateQueries(getGetSystemStatsQueryKey());
      });
    },
    createUser: (body: UserCreate) => {
      return fetch(`/user`, { method: "POST", body }).then(() => {
        set({ editingUser: null });
        get().refetchUsers();
        queryClient.invalidateQueries(getGetSystemStatsQueryKey());
      });
    },
    editUser: (body: UserCreate) => {
      return fetch(`/user/${body.username}`, { method: "PUT", body }).then(
        () => {
          get().onEditingUser(null);
          get().refetchUsers();
        }
      );
    },
    fetchUserUsage: (body: Required<UserResponse>, query: FilterUsageType) => {
      for (const key in query) {
        if (!query[key as keyof FilterUsageType])
          delete query[key as keyof FilterUsageType];
      }
      return fetch(`/user/${body.username}/usage`, { method: "GET", query });
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
    revokeSubscription: (user) => {
      return fetch(`/user/${user.username}/revoke_sub`, {
        method: "POST",
      }).then((user) => {
        set({ revokeSubscriptionUser: null, editingUser: user });
        get().refetchUsers();
      });
    },
  }))
);

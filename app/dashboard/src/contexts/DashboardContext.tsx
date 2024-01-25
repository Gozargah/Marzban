import { GetUsersParams, UserResponse, getGetUsersQueryKey, useGetUsers } from "service/api";
import { User } from "types/User";
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
  filters: GetUsersParams;
  subscribeUrl: string | null;
  QRcodeLinks: string[] | null;
  isEditingHosts: boolean;
  isEditingNodes: boolean;
  isShowingNodesUsage: boolean;
  isResetingAllUsage: boolean;
  resetUsageUser: Required<UserResponse> | null;
  revokeSubscriptionUser: Required<UserResponse> | null;
  isEditingCore: boolean;
  onResetAllUsage: (isResetingAllUsage: boolean) => void;
  onCreateUser: (isOpen: boolean) => void;
  onEditingUser: (user: Required<UserResponse> | null) => void;
  onDeletingUser: (user: Required<UserResponse> | null) => void;
  refetchUsers: () => void;
  onFilterChange: (filters: Partial<GetUsersParams>) => void;
  setQRCode: (links: string[] | null) => void;
  setSubLink: (subscribeURL: string | null) => void;
  onEditingHosts: (isEditingHosts: boolean) => void;
  onEditingNodes: (isEditingHosts: boolean) => void;
  onShowingNodesUsage: (isShowingNodesUsage: boolean) => void;
};

export const useUsers = () => {
  const { filters } = useDashboard();
  return useGetUsers<{
    users: Required<UserResponse>[];
    total: number;
  }>(filters);
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
      username: [""],
      limit: getUsersPerPageLimitSize(),
      sort: "-created_at",
    },
    isEditingCore: false,
    refetchUsers: () => {
      queryClient.invalidateQueries(getGetUsersQueryKey());
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
    },
    setQRCode: (QRcodeLinks) => {
      set({ QRcodeLinks });
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
  }))
);

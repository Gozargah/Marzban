import { StatisticsQueryKey } from "components/Statistics";
import { fetch } from "service/http";
import { User, UserCreate } from "types/User";
import { queryClient } from "utils/react-query";
import { getUsersPerPageLimitSize } from "utils/userPreferenceStorage";
import { create } from "zustand";
import { subscribeWithSelector } from "zustand/middleware";

export type FilterType = {
  search?: string;
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
  editingUser: User | null | undefined;
  deletingUser: User | null;
  version: string | null;
  users: {
    users: User[];
    total: number;
  };
  inbounds: Inbounds;
  loading: boolean;
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
  onFilterChange: (filters: Partial<FilterType>) => void;
  deleteUser: (user: User) => Promise<void>;
  createUser: (user: UserCreate) => Promise<void>;
  editUser: (user: UserCreate) => Promise<void>;
  fetchUserUsage: (user: User, query: FilterUsageType) => Promise<void>;
  setQRCode: (links: string[] | null) => void;
  setSubLink: (subscribeURL: string | null) => void;
  onEditingHosts: (isEditingHosts: boolean) => void;
  onEditingNodes: (isEditingHosts: boolean) => void;
  onShowingNodesUsage: (isShowingNodesUsage: boolean) => void;
  resetDataUsage: (user: User) => Promise<void>;
  revokeSubscription: (user: User) => Promise<void>;
};

const fetchUsers = (query: FilterType): Promise<User[]> => {
  for (const key in query) {
    if (!query[key as keyof FilterType]) delete query[key as keyof FilterType];
  }
  useDashboard.setState({ loading: true });
  return fetch("/users", { query })
    .then((users) => {
      useDashboard.setState({ users });
      return users;
    })
    .finally(() => {
      useDashboard.setState({ loading: false });
    });
};

export const fetchInbounds = () => {
  return fetch("/inbounds")
    .then((inbounds: Inbounds) => {
      useDashboard.setState({
        inbounds: new Map(Object.entries(inbounds)) as Inbounds,
      });
    })
    .finally(() => {
      useDashboard.setState({ loading: false });
    });
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
    inbounds: new Map(),
    isEditingCore: false,
    refetchUsers: () => {
      fetchUsers(get().filters);
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
    deleteUser: (user: User) => {
      set({ editingUser: null });
      return fetch(`/user/${user.username}`, { method: "DELETE" }).then(() => {
        set({ deletingUser: null });
        get().refetchUsers();
        queryClient.invalidateQueries(StatisticsQueryKey);
      });
    },
    createUser: (body: UserCreate) => {
      return fetch(`/user`, { method: "POST", body }).then(() => {
        set({ editingUser: null });
        get().refetchUsers();
        queryClient.invalidateQueries(StatisticsQueryKey);
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
    fetchUserUsage: (body: User, query: FilterUsageType) => {
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
    resetDataUsage: (user) => {
      return fetch(`/user/${user.username}/reset`, { method: "POST" }).then(
        () => {
          set({ resetUsageUser: null });
          get().refetchUsers();
        }
      );
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

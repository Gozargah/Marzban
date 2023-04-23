import { fetch } from "service/http";
import { mutate as globalMutate } from "swr";
import { User, UserCreate } from "types/User";
import { create } from "zustand";
import { subscribeWithSelector } from "zustand/middleware";

export type FilterType = {
  username?: string;
  limit?: number;
  offset?: number;
  sort: string;
  status?: "active" | "disabled" | "limited" | "expired";
};
export type ProtocolType = "vmess" | "vless" | "trojan" | "shadowsocks";

export type InboundType = {
  tag: string;
  protocol: ProtocolType;
  network: string;
  tls: boolean;
  port?: number;
};
export type Inbounds = Map<ProtocolType, InboundType[]>;

type DashboardStateType = {
  isCreatingNewUser: boolean;
  editingUser: User | null | undefined;
  deletingUser: User | null;
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
  isResetingAllUsage: boolean;
  resetUsageUser: User | null;
  onCreateUser: (isOpen: boolean) => void;
  onEditingUser: (user: User | null) => void;
  onDeletingUser: (user: User | null) => void;
  onResetAllUsage:(isResetingAllUsage: boolean) => void;
  refetchUsers: () => void;
  resetAllUsage: () => Promise<void>;
  onFilterChange: (filters: Partial<FilterType>) => void;
  deleteUser: (user: User) => Promise<void>;
  createUser: (user: UserCreate) => Promise<void>;
  editUser: (user: UserCreate) => Promise<void>;
  setQRCode: (links: string[] | null) => void;
  setSubLink: (subscribeURL: string | null) => void;
  onEditingHosts: (isEditingHosts: boolean) => void;
  onEditingNodes: (isEditingHosts: boolean) => void;
  resetDataUsage: (user: User) => Promise<void>;
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

type HostsSchema = Record<
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
  hosts: HostsSchema;
  fetchHosts: () => void;
  setHosts: (hosts: HostsSchema) => Promise<void>;
};
export const useHosts = create<HostsStore>((set) => ({
  isLoading: false,
  isPostLoading: false,
  hosts: {},
  fetchHosts: () => {
    set({ isLoading: true });
    fetch("/hosts")
      .then((hosts) => set({ hosts }))
      .finally(() => set({ isLoading: false }));
  },
  setHosts: (body) => {
    set({ isPostLoading: true });
    return fetch("/hosts", { method: "PUT", body }).finally(() => {
      set({ isPostLoading: false });
    });
  },
}));

export const useDashboard = create(
  subscribeWithSelector<DashboardStateType>((set, get) => ({
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
    resetUsageUser: null,
    filters: { username: "", limit: 10, sort: "-created_at" },
    inbounds: new Map(),
    refetchUsers: () => {
      fetchUsers(get().filters);
    },
    resetAllUsage: () => {
      return fetch(`/users/reset`, { method: "POST" }).then(
        () => {
          get().onResetAllUsage(false);
          get().refetchUsers();
        }
      );
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
        globalMutate("/system");
      });
    },
    createUser: (body: UserCreate) => {
      return fetch(`/user`, { method: "POST", body }).then(() => {
        set({ editingUser: null });
        get().refetchUsers();
        globalMutate("/system");
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
    onEditingHosts: (isEditingHosts: boolean) => {
      set({ isEditingHosts });
    },
    onEditingNodes: (isEditingNodes: boolean) => {
      set({ isEditingNodes });
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
  }))
);

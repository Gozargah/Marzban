import { fetch } from "service/http";
import { mutate as globalMutate } from "swr";
import { User, UserCreate } from "types/User";
import { create } from "zustand";

export type FilterType = {
  username?: string;
  limit?: number;
  offset?: number;
  status?: "active" | "disabled" | "limited" | "expired";
};

type DashboardStateType = {
  isCreatingNewUser: boolean;
  editingUser: User | null | undefined;
  deletingUser: User | null;
  users: {
    users: User[];
    total: number;
  };
  loading: boolean;
  filters: FilterType;
  subscribeUrl: string | null;
  QRcodeLinks: string[] | null;
  isEditingHosts: boolean;
  onCreateUser: (isOpen: boolean) => void;
  onEditingUser: (user: User | null) => void;
  onDeletingUser: (user: User | null) => void;
  refetchUsers: () => void;
  onFilterChange: (filters: FilterType) => void;
  deleteUser: (user: User) => Promise<void>;
  createUser: (user: UserCreate) => Promise<void>;
  editUser: (user: UserCreate) => Promise<void>;
  setQRCode: (links: string[] | null) => void;
  setSubLink: (subscribeURL: string | null) => void;
  onEditingHosts: (isEditingHosts: boolean) => void;
  resetDataUsage: (user: User) => Promise<void>;
};

const fetchUsers = (query: FilterType): Promise<User[]> => {
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

type HostsSchema = Record<
  string,
  {
    remark: string;
    address: string;
    port: number | null;
    sni: string;
    host: string;
    inbound_tag: string;
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

export const useDashboard = create<DashboardStateType>((set, get) => ({
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
  isEditingHosts: false,
  filters: { username: "", limit: 15 },
  refetchUsers: () => {
    fetchUsers(get().filters);
  },
  onCreateUser: (isCreatingNewUser) => set({ isCreatingNewUser }),
  onEditingUser: (editingUser) => {
    set({ editingUser });
  },
  onDeletingUser: (deletingUser) => {
    set({ deletingUser });
  },
  onFilterChange: (filters) => {
    set({ filters });
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
    return fetch(`/user/${body.username}`, { method: "PUT", body }).then(() => {
      get().onEditingUser(null);
      get().refetchUsers();
    });
  },
  onEditingHosts: (isEditingHosts: boolean) => {
    set({ isEditingHosts });
  },
  setSubLink: (subscribeUrl) => {
    set({ subscribeUrl });
  },
  resetDataUsage: (user) => {
    return fetch(`/user/${user.username}/reset`, { method: "POST" }).then(
      () => {
        get().onEditingUser(null);
        get().refetchUsers();
      }
    );
  },
}));

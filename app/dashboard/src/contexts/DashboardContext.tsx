import { fetch } from "service/http";
import { mutate as globalMutate } from "swr";
import { User, UserCreate } from "types/User";
import { create } from "zustand";
import { computed } from "zustand-computed";

export type FilterType = {
  search: string;
};

type ComputedStore = {
  filteredUsers: User[];
};

type DashboardStateType = {
  isCreatingNewUser: boolean;
  editingUser: User | null | undefined;
  deletingUser: User | null;
  users: User[];
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
} & DashboardStateType;

const dashboardContextInitialValue: DashboardContextType = {
  editingUser: null,
  deletingUser: null,
  isCreatingNewUser: false,
  qrcodeLinks: null,
  users: [],
  filteredUsers: [],
  loading: true,
  filters: { search: "" },
  onCreateUser: () => { },
  onEditingUser: (user) => { },
  onDeletingUser: (user) => { },
  refetchUsers: () => { },
  onFilterChange: (filters) => { },
  setQRCode: (links) => { },
  deleteUser: (user) => {
    return new Promise(() => { });
  },
  createUser: (user) => {
    return new Promise(() => { });
  },
  editUser: (user) => {
    return new Promise(() => { });
  },
  resetDataUsage: (user) => {
    return new Promise(() => { });
  },
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

export const useDashboard = create<
  DashboardStateType,
  [["chrisvander/zustand-computed", ComputedStore]]
>(
  computed(
    (set, get) => ({
      editingUser: null,
      deletingUser: null,
      isCreatingNewUser: false,
      QRcodeLinks: null,
      subscribeUrl: null,
      users: [],
      loading: true,
      isEditingHosts: false,
      filters: { search: "" },
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
      },
      setQRCode: (QRcodeLinks) => {
        set({ QRcodeLinks });
      },
      deleteUser: (user: User) => {
        set({ editingUser: null });
        return fetch(`/user/${user.username}`, { method: "DELETE" }).then(
          () => {
            set({ deletingUser: null });
            get().refetchUsers();
            globalMutate("/system");
          }
        );
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
            set({ editingUser: null });
            get().refetchUsers();
          }
        );
      },
      onEditingHosts: (isEditingHosts: boolean) => {
        set({ isEditingHosts });
      },
      setSubLink: (subscribeUrl) => {
        set({ subscribeUrl });
      },
    }),
    (state): ComputedStore => {
      return {
        filteredUsers: state.users.filter(
          (user) => user.username.indexOf(state.filters.search) > -1
        ),
      };
    }
  )
);


// export const useDashboard = () => useContext(DashboardContext);

// type DashboardProviderProps = PropsWithChildren<{}>;

// const dashboardReducer: Reducer<DashboardStateType, DashboardActionsType> = (
//   state,
//   action
// ) => {
//   switch (action.type) {
//     case "CreatingNewUser":
//       return { ...state, isCreatingNewUser: action.isOpen };
//     case "EditingUser":
//       return { ...state, editingUser: action.user };
//     case "DeletingUser":
//       return { ...state, deletingUser: action.user };
//     case "FilterChange":
//       return { ...state, filters: action.filters };
//     case "SetQrCode":
//       return { ...state, qrcodeLinks: action.links };
//     default:
//       return state;
//   }
// };

// export const DashboardProvider: FC<DashboardProviderProps> = ({ children }) => {
//   const [state, dispatch] = useReducer(
//     dashboardReducer,
//     dashboardContextInitialValue
//   );

//   const {
//     data: users,
//     isValidating: usersLoading,
//     mutate,
//   } = useSWR<User[]>("/users");

//   const onCreateUser = useCallback((isOpen: boolean) => {
//     dispatch({
//       type: "CreatingNewUser",
//       isOpen,
//     });
//   }, []);
//   const refetchUsers = useCallback(() => {
//     mutate();
//   }, []);

//   const onEditingUser = useCallback((user: User | null) => {
//     dispatch({
//       type: "EditingUser",
//       user,
//     });
//   }, []);

//   const onDeletingUser = useCallback((user: User | null) => {
//     dispatch({
//       type: "DeletingUser",
//       user,
//     });
//   }, []);

//   const onFilterChange = useCallback((filters: FilterType) => {
//     dispatch({
//       type: "FilterChange",
//       filters,
//     });
//   }, []);

//   const deleteUser = useCallback((user: User) => {
//     onEditingUser(null);
//     return fetch(`/user/${user.username}`, { method: "DELETE" }).then(() => {
//       onDeletingUser(null);
//       refetchUsers();
//       globalMutate("/system");
//     });
//   }, []);

//   const createUser = useCallback((body: UserCreate) => {
//     return fetch(`/user`, { method: "POST", body }).then(() => {
//       onEditingUser(null);
//       refetchUsers();
//       globalMutate("/system");
//     });
//   }, []);

//   const editUser = useCallback((body: UserCreate) => {
//     return fetch(`/user/${body.username}`, { method: "PUT", body }).then(() => {
//       onEditingUser(null);
//       refetchUsers();
//     });
//   }, []);

//   const resetDataUsage = useCallback((user: User) => {
//     return fetch(`/user/${user.username}/reset`, { method: "POST" }).then(
//       () => {
//         onEditingUser(null);
//         refetchUsers();
//       }
//     );
//   }, []);

//   const setQRCode = useCallback((links: string[] | null) => {
//     dispatch({
//       type: "SetQrCode",
//       links,
//     });
//   }, []);

//   const filteredUsers = useMemo(() => {
//     if (!users) return [];
//     return users.filter(
//       (user) => user.username.indexOf(state.filters.search) > -1
//     );
//   }, [state.filters, users]);

//   const states: DashboardContextType = {
//     ...state,
//     users: users || [],
//     filteredUsers,
//     loading: usersLoading,
//     refetchUsers,
//     onEditingUser,
//     onDeletingUser,
//     onCreateUser,
//     onFilterChange,
//     deleteUser,
//     createUser,
//     editUser,
//     setQRCode,
//     resetDataUsage,
//   };

//   return (
//     <DashboardContext.Provider value={states}>
//       {children}
//     </DashboardContext.Provider>
//   );
// };

// export default DashboardProvider;

fetchUsers(useDashboard.getState().filters);

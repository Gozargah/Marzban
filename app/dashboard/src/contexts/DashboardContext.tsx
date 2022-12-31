import React, {
  FC,
  PropsWithChildren,
  Reducer,
  useCallback,
  useContext,
  useMemo,
  useReducer,
} from "react";
import { fetch } from "service/http";
import useSWR, { mutate as globalMutate } from "swr";
import { User, UserCreate } from "types/User";

export type FilterType = {
  search: string;
};

type DashboardStateType = {
  isCreatingNewUser: boolean;
  editingUser: User | null;
  deletingUser: User | null;
  users: User[];
  filteredUsers: User[];
  loading: boolean;
  filters: FilterType;
  qrcodeLinks: string[] | null;
};
type DashboardActionsType =
  | { type: "EditingUser"; user: User | null }
  | { type: "DeletingUser"; user: User | null }
  | { type: "CreatingNewUser"; isOpen: boolean }
  | { type: "FilterChange"; filters: FilterType }
  | { type: "SetQrCode"; links: string[] | null };

type DashboardContextType = {
  onCreateUser: (isOpen: boolean) => void;
  onEditingUser: (user: User | null) => void;
  onDeletingUser: (user: User | null) => void;
  refetchUsers: () => void;
  onFilterChange: (filters: FilterType) => void;
  deleteUser: (user: User) => Promise<void>;
  createUser: (user: UserCreate) => Promise<void>;
  editUser: (user: UserCreate) => Promise<void>;
  setQRCode: (links: string[] | null) => void;
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
  onCreateUser: () => {},
  onEditingUser: (user) => {},
  onDeletingUser: (user) => {},
  refetchUsers: () => {},
  onFilterChange: (filters) => {},
  setQRCode: (links) => {},
  deleteUser: (user) => {
    return new Promise(() => {});
  },
  createUser: (user) => {
    return new Promise(() => {});
  },
  editUser: (user) => {
    return new Promise(() => {});
  },
};

export const DashboardContext = React.createContext<DashboardContextType>(
  dashboardContextInitialValue
);

export const useDashboard = () => useContext(DashboardContext);

type DashboardProviderProps = PropsWithChildren<{}>;

const dashboardReducer: Reducer<DashboardStateType, DashboardActionsType> = (
  state,
  action
) => {
  switch (action.type) {
    case "CreatingNewUser":
      return { ...state, isCreatingNewUser: action.isOpen };
    case "EditingUser":
      return { ...state, editingUser: action.user };
    case "DeletingUser":
      return { ...state, deletingUser: action.user };
    case "FilterChange":
      return { ...state, filters: action.filters };
    case "SetQrCode":
      return { ...state, qrcodeLinks: action.links };
    default:
      return state;
  }
};

export const DashboardProvider: FC<DashboardProviderProps> = ({ children }) => {
  const [state, dispatch] = useReducer(
    dashboardReducer,
    dashboardContextInitialValue
  );

  const {
    data: users,
    isValidating: usersLoading,
    mutate,
  } = useSWR<User[]>("/users");

  const onCreateUser = useCallback((isOpen: boolean) => {
    dispatch({
      type: "CreatingNewUser",
      isOpen,
    });
  }, []);
  const refetchUsers = useCallback(() => {
    mutate();
  }, []);

  const onEditingUser = useCallback((user: User | null) => {
    dispatch({
      type: "EditingUser",
      user,
    });
  }, []);

  const onDeletingUser = useCallback((user: User | null) => {
    dispatch({
      type: "DeletingUser",
      user,
    });
  }, []);

  const onFilterChange = useCallback((filters: FilterType) => {
    dispatch({
      type: "FilterChange",
      filters,
    });
  }, []);

  const deleteUser = useCallback((user: User) => {
    onEditingUser(null);
    return fetch(`/user/${user.username}`, { method: "DELETE" }).then(() => {
      onDeletingUser(null);
      refetchUsers();
      globalMutate("/system");
    });
  }, []);

  const createUser = useCallback((body: UserCreate) => {
    return fetch(`/user/`, { method: "POST", body }).then(() => {
      onEditingUser(null);
      refetchUsers();
      globalMutate("/system");
    });
  }, []);

  const editUser = useCallback((body: UserCreate) => {
    return fetch(`/user/${body.username}`, { method: "PUT", body }).then(() => {
      onEditingUser(null);
      refetchUsers();
    });
  }, []);

  const setQRCode = useCallback((links: string[] | null) => {
    dispatch({
      type: "SetQrCode",
      links,
    });
  }, []);

  const filteredUsers = useMemo(() => {
    if (!users) return [];
    return users.filter(
      (user) => user.username.indexOf(state.filters.search) > -1
    );
  }, [state.filters, users]);

  const states: DashboardContextType = {
    ...state,
    users: users || [],
    filteredUsers,
    loading: usersLoading,
    refetchUsers,
    onEditingUser,
    onDeletingUser,
    onCreateUser,
    onFilterChange,
    deleteUser,
    createUser,
    editUser,
    setQRCode,
  };

  return (
    <DashboardContext.Provider value={states}>
      {children}
    </DashboardContext.Provider>
  );
};

export default DashboardProvider;

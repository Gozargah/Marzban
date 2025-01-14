import { StatisticsQueryKey } from '@/components/Statistics'
import { addUser, getInbounds, getUsers, modifyUser, ProxyInbound, removeUser, resetUserDataUsage, resetUsersDataUsage, revokeUserSubscription, UserCreate, UserModify, UserResponse } from '@/service/api'
import { fetch } from '@/service/http'
import { queryClient } from '@/utils/query-client'
import { getUsersPerPageLimitSize } from '@/utils/userPreferenceStorage'
import { create } from 'zustand'
import { subscribeWithSelector } from 'zustand/middleware'

export type FilterType = {
  search?: string
  limit?: number
  offset?: number
  sort: string
  status?: 'active' | 'disabled' | 'limited' | 'expired' | 'on_hold'
}

export type ProtocolType = 'vmess' | 'vless' | 'trojan' | 'shadowsocks'

export type FilterUsageType = {
  start?: string
  end?: string
}

export type InboundType = {
  tag: string
  protocol: ProtocolType
  network: string
  tls: string
  port?: number
}

export type Inbounds = Map<ProtocolType, ProxyInbound[]>

type DashboardStateType = {
  isCreatingNewUser: boolean
  editingUser: UserResponse | null | undefined
  deletingUser: UserResponse | null
  version: string | null
  users: {
    users: UserResponse[]
    total: number
  }
  inbounds: Inbounds
  loading: boolean
  filters: FilterType
  subscribeUrl: string | null
  QRcodeLinks: string[] | null
  isEditingHosts: boolean
  isEditingNodes: boolean
  isShowingNodesUsage: boolean
  isResetingAllUsage: boolean
  resetUsageUser: UserResponse | null
  revokeSubscriptionUser: UserResponse | null
  isEditingCore: boolean
  onCreateUser: (isOpen: boolean) => void
  onEditingUser: (user: UserResponse | null) => void
  onDeletingUser: (user: UserResponse | null) => void
  onResetAllUsage: (isResetingAllUsage: boolean) => void
  refetchUsers: () => void
  resetAllUsage: () => Promise<void>
  onFilterChange: (filters: Partial<FilterType>) => void
  deleteUser: (user: UserResponse) => Promise<void>
  createUser: (user: UserCreate) => Promise<void>
  editUser: (user: Omit<UserModify, 'username'> & {username: string}) => Promise<void>
  fetchUserUsage: (user: UserResponse, query: FilterUsageType) => Promise<void>
  setQRCode: (links: string[] | null) => void
  setSubLink: (subscribeURL: string | null) => void
  onEditingHosts: (isEditingHosts: boolean) => void
  onEditingNodes: (isEditingHosts: boolean) => void
  onShowingNodesUsage: (isShowingNodesUsage: boolean) => void
  resetDataUsage: (user: UserResponse) => Promise<void>
  revokeSubscription: (user: UserResponse) => Promise<void>
}

const fetchUsers = (query: FilterType): Promise<UserResponse[]> => {
  for (const key in query) {
    if (!query[key as keyof FilterType]) delete query[key as keyof FilterType]
  }
  useDashboard.setState({ loading: true })
  return getUsers(query)
    .then(users => {
      useDashboard.setState({ users })
      return users.users
    })
    .finally(() => {
      useDashboard.setState({ loading: false })
    })
}

export const fetchInbounds = () => {
  return getInbounds()
    .then((inbounds) => {
		inbounds
      useDashboard.setState({
        inbounds: new Map(Object.entries(inbounds)) as Inbounds,
      })
    })
    .finally(() => {
      useDashboard.setState({ loading: false })
    })
}

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
      username: '',
      limit: getUsersPerPageLimitSize(),
      sort: '-created_at',
    },
    inbounds: new Map(),
    isEditingCore: false,
    refetchUsers: () => {
      fetchUsers(get().filters)
    },
    resetAllUsage: () => {
      return resetUsersDataUsage().then(() => {
        get().onResetAllUsage(false)
        get().refetchUsers()
      })
    },
    onResetAllUsage: isResetingAllUsage => set({ isResetingAllUsage }),
    onCreateUser: isCreatingNewUser => set({ isCreatingNewUser }),
    onEditingUser: editingUser => {
      set({ editingUser })
    },
    onDeletingUser: deletingUser => {
      set({ deletingUser })
    },
    onFilterChange: filters => {
      set({
        filters: {
          ...get().filters,
          ...filters,
        },
      })
      get().refetchUsers()
    },
    setQRCode: QRcodeLinks => {
      set({ QRcodeLinks })
    },
    deleteUser: (user: UserResponse) => {
      set({ editingUser: null })
      return removeUser(user.username).then(() => {
        set({ deletingUser: null })
        get().refetchUsers()
        queryClient.invalidateQueries({queryKey: StatisticsQueryKey})
      })
    },
    createUser: (body) => {
      return addUser(body).then(() => {
        set({ editingUser: null })
        get().refetchUsers()
        queryClient.invalidateQueries({queryKey: StatisticsQueryKey})
      })
    },
    editUser: (body) => {
      return modifyUser(body.username, body).then(() => {
        get().onEditingUser(null)
        get().refetchUsers()
      })
    },
    fetchUserUsage: (body: UserResponse, query: FilterUsageType) => {
      for (const key in query) {
        if (!query[key as keyof FilterUsageType]) delete query[key as keyof FilterUsageType]
      }
      return fetch(`/user/${body.username}/usage`, { params: query })
    },
    onEditingHosts: (isEditingHosts: boolean) => {
      set({ isEditingHosts })
    },
    onEditingNodes: (isEditingNodes: boolean) => {
      set({ isEditingNodes })
    },
    onShowingNodesUsage: (isShowingNodesUsage: boolean) => {
      set({ isShowingNodesUsage })
    },
    setSubLink: subscribeUrl => {
      set({ subscribeUrl })
    },
    resetDataUsage: user => {
      return resetUserDataUsage(user.username).then(() => {
        set({ resetUsageUser: null })
        get().refetchUsers()
      })
    },
    revokeSubscription: user => {
      return revokeUserSubscription(user.username).then(() => {
        set({ revokeSubscriptionUser: null, editingUser: user })
        get().refetchUsers()
      })
    },
  })),
)

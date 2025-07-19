import { setupColumns } from '@/components/users/columns'
import { DataTable } from '@/components/users/data-table'
import { Filters } from '@/components/users/filters'
import useDirDetection from '@/hooks/use-dir-detection'
import { UseEditFormValues } from '@/pages/_dashboard._index'
import {getUsers, UserResponse, UserStatus} from '@/service/api'
import { getUsersPerPageLimitSize } from '@/utils/userPreferenceStorage'
import { useQueryClient } from '@tanstack/react-query'
import { useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import { useTranslation } from 'react-i18next'
import UserModal from '../dialogs/UserModal'
import { PaginationControls } from './filters'
import AdvanceSearchModal, {AdvanceSearchFormValue} from "@/components/dialogs/AdvanceSearchModal.tsx";

const UsersTable = () => {
  const { t } = useTranslation()
  const dir = useDirDetection()
  const queryClient = useQueryClient()
  const [currentPage, setCurrentPage] = useState(0)
  const [itemsPerPage, setItemsPerPage] = useState(getUsersPerPageLimitSize())
  const [isChangingPage, setIsChangingPage] = useState(false)
  const [isEditModalOpen, setEditModalOpen] = useState(false)
  const [selectedUser, setSelectedUser] = useState<UserResponse | null>(null)
  const [isAdvanceSearchOpen, setIsAdvanceSearchOpen] = useState(false)
  const [advancedSearchFlags, setAdvancedSearchFlags] = useState<{
    is_username: boolean
    is_protocol: boolean
  }>({
    is_username: true,
    is_protocol: false,
  })

  const [filters, setFilters] = useState<{
    limit: number
    sort: string
    load_sub: boolean
    offset: number
    search?: string
    proxy_id?: string
    admin?: string[]
    group?: number[]
    status?: UserStatus | null
    search_fields?: string[]
  }>({
    limit: itemsPerPage,
    sort: '-created_at',
    load_sub: true,
    offset: 0,
    search: undefined,
    proxy_id: undefined,
  })

  const advanceSearchForm = useForm<AdvanceSearchFormValue>()


  // Create form for user editing
  const userForm = useForm<UseEditFormValues>({
    defaultValues: {
      username: selectedUser?.username,
      status: selectedUser?.status === 'active' || selectedUser?.status === 'on_hold' || selectedUser?.status === 'disabled' ? selectedUser?.status : 'active',
      data_limit: selectedUser?.data_limit ? Math.round((Number(selectedUser?.data_limit) / (1024 * 1024 * 1024)) * 100) / 100 : undefined, // Convert bytes to GB
      expire: selectedUser?.expire,
      note: selectedUser?.note || '',
      data_limit_reset_strategy: selectedUser?.data_limit_reset_strategy || undefined,
      group_ids: selectedUser?.group_ids || [], // Add group_ids
      on_hold_expire_duration: selectedUser?.on_hold_expire_duration || undefined,
      on_hold_timeout: selectedUser?.on_hold_timeout || undefined,
      proxy_settings: selectedUser?.proxy_settings || undefined,
      next_plan: selectedUser?.next_plan
        ? {
            user_template_id: selectedUser?.next_plan.user_template_id ? Number(selectedUser?.next_plan.user_template_id) : undefined,
            data_limit: selectedUser?.next_plan.data_limit ? Number(selectedUser?.next_plan.data_limit) : undefined,
            expire: selectedUser?.next_plan.expire ? Number(selectedUser?.next_plan.expire) : undefined,
            add_remaining_traffic: selectedUser?.next_plan.add_remaining_traffic || false,
          }
        : undefined,
    },
  })

  // Update form when selected user changes
  useEffect(() => {
    if (selectedUser) {
      const values: UseEditFormValues = {
        username: selectedUser.username,
        status: selectedUser.status === 'active' || selectedUser.status === 'on_hold' ? selectedUser.status : 'active',
        data_limit: selectedUser.data_limit ? Math.round((Number(selectedUser.data_limit) / (1024 * 1024 * 1024)) * 100) / 100 : 0, // Convert bytes to GB
        expire: selectedUser.expire,
        note: selectedUser.note || '',
        data_limit_reset_strategy: selectedUser.data_limit_reset_strategy || undefined,
        group_ids: selectedUser.group_ids || [],
        on_hold_expire_duration: selectedUser.on_hold_expire_duration || undefined,
        on_hold_timeout: selectedUser.on_hold_timeout || undefined,
        proxy_settings: selectedUser.proxy_settings || undefined,
        next_plan: selectedUser.next_plan
          ? {
              user_template_id: selectedUser.next_plan.user_template_id ? Number(selectedUser.next_plan.user_template_id) : undefined,
              data_limit: selectedUser.next_plan.data_limit ? Number(selectedUser.next_plan.data_limit) : undefined,
              expire: selectedUser.next_plan.expire ? Number(selectedUser.next_plan.expire) : undefined,
              add_remaining_traffic: selectedUser.next_plan.add_remaining_traffic || false,
            }
          : undefined,
      }
      userForm.reset(values)
    }
  }, [selectedUser, userForm])

  // Update filters when pagination changes
  useEffect(() => {
    setFilters(prev => ({
      ...prev,
      limit: itemsPerPage,
      offset: currentPage * itemsPerPage,
    }))
  }, [currentPage, itemsPerPage])

  const [mergedUsers, setMergedUsers] = useState<UserResponse[]>([])
  const [totalUsers, setTotalUsers] = useState(0)
  const [isPageLoading, setIsPageLoading] = useState(false)

  const mergeUsers = (arr1: UserResponse[], arr2: UserResponse[]) => {
    const map = new Map<string | number, UserResponse>()
    arr1.forEach(u => map.set(u.id, u))
    arr2.forEach(u => map.set(u.id, u))
    return Array.from(map.values())
  }

  // Fetch users logic
  useEffect(() => {
    let cancelled = false
    async function fetchUsers() {
      setIsPageLoading(true)
      // Both username and proxy_id
      if (advancedSearchFlags.is_username && advancedSearchFlags.is_protocol && filters.search) {
        // Fetch by username
        const [byUsername, byProxyId] = await Promise.all([
          getUsers({ ...filters, search: filters.search, proxy_id: undefined }),
          getUsers({ ...filters, search: undefined, proxy_id: filters.search }),
        ])
        if (!cancelled) {
          setMergedUsers(mergeUsers(byUsername.users || [], byProxyId.users || []))
          setTotalUsers(mergedUsers.length)
        }
      } else if (advancedSearchFlags.is_username && filters.search) {
        // Only username
        const byUsername = await getUsers({ ...filters, search: filters.search, proxy_id: undefined })
        if (!cancelled) {
          setMergedUsers(byUsername.users || [])
          setTotalUsers(byUsername.total || 0)
        }
      } else if (advancedSearchFlags.is_protocol && filters.search) {
        // Only proxy_id
        const byProxyId = await getUsers({ ...filters, search: undefined, proxy_id: filters.search })
        if (!cancelled) {
          setMergedUsers(byProxyId.users || [])
          setTotalUsers(byProxyId.total || 0)
        }
      } else {
        // Default: fetch with current filters
        const result = await getUsers(filters)
        if (!cancelled) {
          setMergedUsers(result.users || [])
          setTotalUsers(result.total || 0)
        }
      }
      setIsPageLoading(false)
    }
    fetchUsers()
    return () => {
      cancelled = true
    }
  }, [filters, advancedSearchFlags])


  const handleSort = (column: string) => {
    let newSort: string

    if (filters.sort === column) {
      newSort = '-' + column
    } else if (filters.sort === '-' + column) {
      newSort = '-created_at'
    } else {
      newSort = column
    }

    setFilters(prev => ({ ...prev, sort: newSort }))
  }

  const handleStatusFilter = (value: any) => {
    // If value is '0' or empty, set status to undefined to remove it from the URL
    if (value === '0' || value === '') {
      setFilters(prev => ({
        ...prev,
        status: undefined, // Set to undefined so it won't be included in the request
        offset: 0, // Reset to first page when changing filter
      }))
    } else {
      setFilters(prev => ({
        ...prev,
        status: value, // Otherwise set the actual status value
        offset: 0, // Reset to first page when changing filter
      }))
    }

    setCurrentPage(0) // Reset current page
  }

  const handleFilterChange = (newFilters: Partial<typeof filters>) => {
    // Handle search logic based on advanced search flags
    let searchValue: string | undefined = undefined
    let proxyIdValue: string | undefined = undefined

    if (newFilters.search !== undefined) {
      const searchInputValue = newFilters.search

      // If is_username is true, use the search value for username search
      if (advancedSearchFlags.is_username) {
        searchValue = searchInputValue
      }

      // If is_protocol is true, use the search value for proxy_id search
      if (advancedSearchFlags.is_protocol) {
        proxyIdValue = searchInputValue
      }
      setFilters(prev => ({
        ...prev,
        ...newFilters,
        search: searchValue,
        proxy_id: proxyIdValue,
        offset: newFilters.search !== undefined ? 0 : prev.offset,
      }))
      if (newFilters.search !== undefined) {
        setCurrentPage(0)
      }
    }
  }

  const handleManualRefresh = async () => {
    // Invalidate queries to ensure fresh data
    queryClient.invalidateQueries({ queryKey: ['getUsers'] })
    // Then refetch
    return getUsers(filters)
  }

  const handlePageChange = async (newPage: number) => {
    if (newPage === currentPage || isChangingPage) return

    setIsChangingPage(true)
    setCurrentPage(newPage)

    try {
      // Wait for state to update before refetching
      await new Promise(resolve => setTimeout(resolve, 0))
      await getUsers(filters)
    } finally {
      // Add a small delay to prevent flickering
      setTimeout(() => {
        setIsChangingPage(false)
      }, 300)
    }
  }

  const handleItemsPerPageChange = async (value: number) => {
    setIsChangingPage(true)
    setItemsPerPage(value)
    setCurrentPage(0) // Reset to first page when items per page changes

    try {
      // Wait for state to update before refetching
      await new Promise(resolve => setTimeout(resolve, 0))
      await getUsers(filters)
    } finally {
      // Add a small delay to prevent flickering
      setTimeout(() => {
        setIsChangingPage(false)
      }, 300)
    }
  }

  const handleEdit = (user: UserResponse) => {
    setSelectedUser(user)
    setEditModalOpen(true)
  }

  const handleEditSuccess = () => {
    setEditModalOpen(false)
    setSelectedUser(null)
    handleManualRefresh()
  }

  const handleAdvanceSearchSubmit = (values: AdvanceSearchFormValue) => {
    setAdvancedSearchFlags({
      is_username: values.is_username,
      is_protocol: values.is_protocol,
    })

    const currentSearchValue = filters.search
    let searchValue: string | undefined = undefined
    let searchFields: string[] | undefined = undefined

    if (currentSearchValue) {
      if (values.is_username && values.is_protocol) {
        // OR logic: search in both fields
        searchValue = currentSearchValue
        searchFields = ['username', 'proxy_id']
      } else if (values.is_username) {
        searchValue = currentSearchValue
        searchFields = ['username']
      } else if (values.is_protocol) {
        searchValue = currentSearchValue
        searchFields = ['proxy_id']
      }
    }

    const statusValue = values.status && values.status.length > 0 ? (values.status[0] as UserStatus) : undefined

    setFilters(prev => ({
      ...prev,
      search: searchValue,
      search_fields: searchFields,
      proxy_id: undefined, // always clear proxy_id, use search_fields instead
      admin: values.admin && values.admin.length > 0 ? values.admin : undefined,
      group: values.group && values.group.length > 0 ? values.group : undefined,
      status: statusValue,
      offset: 0,
    }))

    setCurrentPage(0)
    setIsAdvanceSearchOpen(false)
    advanceSearchForm.reset(values)
  }

  const handleOpenAdvanceSearch = () => {
    // Initialize the form with current advanced search flags
    advanceSearchForm.reset({
      is_username: advancedSearchFlags.is_username,
      is_protocol: advancedSearchFlags.is_protocol,
      admin: filters.admin,
      group: filters.group,
      status: filters.status ? [filters.status] : [],
    })
    setIsAdvanceSearchOpen(true)
  }

  const columns = setupColumns({
    t,
    dir,
    handleSort,
    filters: { sort: filters.sort, status: filters.status ?? undefined },
    handleStatusFilter,
  })

  return (
    <div>
      <Filters filters={filters} onFilterChange={handleFilterChange} refetch={handleManualRefresh} advanceSearchOnOpen={handleOpenAdvanceSearch}/>
      <DataTable columns={columns} data={mergedUsers} isLoading={isPageLoading} isFetching={isPageLoading} onEdit={handleEdit} />
      <PaginationControls
        currentPage={currentPage}
        totalPages={Math.ceil(totalUsers / itemsPerPage)}
        itemsPerPage={itemsPerPage}
        totalUsers={totalUsers}
        isLoading={isPageLoading}
        onPageChange={handlePageChange}
        onItemsPerPageChange={handleItemsPerPageChange}
      />
      {selectedUser && (
        <UserModal
          isDialogOpen={isEditModalOpen}
          onOpenChange={setEditModalOpen}
          form={userForm}
          editingUser={true}
          editingUserId={selectedUser.id || undefined}
          editingUserData={selectedUser}
          onSuccessCallback={handleEditSuccess}
        />
      )}
      {isAdvanceSearchOpen && (
          <AdvanceSearchModal
              isDialogOpen={isAdvanceSearchOpen}
              onOpenChange={open => {
                setIsAdvanceSearchOpen(open)
                if (!open) advanceSearchForm.reset() // Reset form when closing
              }}
              form={advanceSearchForm}
              onSubmit={handleAdvanceSearchSubmit}
          />
      )}
    </div>
  )
}

export default UsersTable

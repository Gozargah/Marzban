import { setupColumns } from '@/components/users/columns'
import { DataTable } from '@/components/users/data-table'
import { Filters } from '@/components/users/filters'
import useDirDetection from '@/hooks/use-dir-detection'
import { UseEditFormValues } from '@/pages/_dashboard._index'
import { useGetUsers, UserResponse } from '@/service/api'
import { getUsersPerPageLimitSize } from '@/utils/userPreferenceStorage'
import { useQueryClient } from '@tanstack/react-query'
import { useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import { useTranslation } from 'react-i18next'
import UserModal from '../dialogs/UserModal'
import { PaginationControls } from './filters'

const UsersTable = () => {
  const { t } = useTranslation()
  const dir = useDirDetection()
  const queryClient = useQueryClient()
  const [currentPage, setCurrentPage] = useState(0)
  const [itemsPerPage, setItemsPerPage] = useState(getUsersPerPageLimitSize())
  const [isChangingPage, setIsChangingPage] = useState(false)
  const [isEditModalOpen, setEditModalOpen] = useState(false)
  const [selectedUser, setSelectedUser] = useState<UserResponse | null>(null)

  const [filters, setFilters] = useState({
    limit: itemsPerPage,
    sort: '-created_at',
    load_sub: true,
    offset: 0,
    search: undefined as string | undefined,
  })

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

  const {
    data: usersData,
    refetch,
    isLoading,
    isFetching,
  } = useGetUsers(filters, {
    query: {
      refetchOnWindowFocus: true,
      staleTime: 30000, // Consider data stale after 30 seconds
    },
  })

  // Force refresh when filters change
  useEffect(() => {
    // Allow state to settle then refetch
    const timeoutId = setTimeout(() => {
      refetch()
    }, 10)

    return () => clearTimeout(timeoutId)
  }, [filters, refetch])

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
    setFilters(prev => ({
      ...prev,
      ...newFilters,
      offset: newFilters.search !== undefined ? 0 : prev.offset, // Reset offset when search changes
    }))

    // Reset page when search changes
    if (newFilters.search !== undefined) {
      setCurrentPage(0)
    }
  }

  const handleManualRefresh = async () => {
    // Invalidate queries to ensure fresh data
    queryClient.invalidateQueries({ queryKey: ['getUsers'] })
    // Then refetch
    return refetch()
  }

  const handlePageChange = async (newPage: number) => {
    if (newPage === currentPage || isChangingPage) return

    setIsChangingPage(true)
    setCurrentPage(newPage)

    try {
      // Wait for state to update before refetching
      await new Promise(resolve => setTimeout(resolve, 0))
      await refetch()
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
      await refetch()
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

  const columns = setupColumns({
    t,
    dir,
    handleSort,
    filters,
    handleStatusFilter,
  })

  const totalUsers = usersData?.total || 0
  const totalPages = Math.ceil(totalUsers / itemsPerPage)
  const isPageLoading = isLoading || isFetching || isChangingPage

  return (
    <div>
      <Filters filters={filters} onFilterChange={handleFilterChange} refetch={handleManualRefresh} />
      <DataTable columns={columns} data={usersData?.users || []} isLoading={isLoading} isFetching={isFetching} onEdit={handleEdit} />
      <PaginationControls
        currentPage={currentPage}
        totalPages={totalPages}
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
    </div>
  )
}

export default UsersTable

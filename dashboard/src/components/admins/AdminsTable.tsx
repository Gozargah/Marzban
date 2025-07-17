import { useTranslation } from 'react-i18next'
import type { AdminDetails } from '@/service/api'
import { useGetAdmins } from '@/service/api'
import { DataTable } from './data-table'
import { setupColumns } from './columns'
import { Filters } from './filters'
import { useEffect, useState } from 'react'
import { PaginationControls } from './filters.tsx'
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog'
import { cn } from '@/lib/utils'
import useDirDetection from '@/hooks/use-dir-detection'
import { Checkbox } from '@/components/ui/checkbox.tsx'

interface AdminFilters {
  sort: string
  username?: string | null
  limit: number
  offset: number
}

interface AdminsTableProps {
  data: AdminDetails[]
  onEdit: (admin: AdminDetails) => void
  onDelete: (admin: AdminDetails) => void
  onToggleStatus: (admin: AdminDetails, checked: boolean) => void
  onResetUsage: (adminUsername: string) => void
}

const DeleteAlertDialog = ({ admin, isOpen, onClose, onConfirm }: { admin: AdminDetails; isOpen: boolean; onClose: () => void; onConfirm: () => void }) => {
  const { t } = useTranslation()
  const dir = useDirDetection()

  return (
    <AlertDialog open={isOpen} onOpenChange={onClose}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{t('admins.deleteAdmin')}</AlertDialogTitle>
          <AlertDialogDescription>
            <span dir={dir} dangerouslySetInnerHTML={{ __html: t('deleteAdmin.prompt', { name: admin.username }) }} />
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel onClick={onClose}>{t('cancel')}</AlertDialogCancel>
          <AlertDialogAction variant="destructive" onClick={onConfirm}>
            {t('delete')}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}

const ToggleAdminStatusModal = ({ admin, isOpen, onClose, onConfirm }: { admin: AdminDetails; isOpen: boolean; onClose: () => void; onConfirm: (clicked: boolean) => void }) => {
  const { t } = useTranslation()
  const dir = useDirDetection()
  const [adminUsersToggle, setAdminUsersToggle] = useState(false)

  useEffect(() => {
    if (!isOpen) {
      setAdminUsersToggle(false)
    }
  }, [isOpen])

  return (
    <AlertDialog open={isOpen} onOpenChange={onClose}>
      <AlertDialogContent>
        <AlertDialogHeader className={cn(dir === 'rtl' && 'sm:text-right')}>
          <AlertDialogTitle>{t(admin.is_disabled ? 'admin.enable' : 'admin.disable')}</AlertDialogTitle>
          <AlertDialogDescription className="flex items-center gap-2">
            <Checkbox checked={adminUsersToggle} onCheckedChange={() => setAdminUsersToggle(!adminUsersToggle)} />
            <span dir={dir} dangerouslySetInnerHTML={{ __html: t(admin.is_disabled ? 'activeUsers.prompt' : 'disableUsers.prompt', { name: admin.username }) }} />
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter className={cn(dir === 'rtl' && 'sm:gap-x-2 sm:flex-row-reverse')}>
          <AlertDialogCancel onClick={onClose}>{t('cancel')}</AlertDialogCancel>
          <AlertDialogAction onClick={() => onConfirm(adminUsersToggle)}>{t('confirm')}</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}

const ResetUsersUsageConfirmationDialog = ({ adminUsername, isOpen, onClose, onConfirm }: { adminUsername: string; isOpen: boolean; onClose: () => void; onConfirm: () => void }) => {
  const { t } = useTranslation()
  const dir = useDirDetection()

  return (
    <AlertDialog open={isOpen} onOpenChange={onClose}>
      <AlertDialogContent>
        <AlertDialogHeader className={cn(dir === 'rtl' && 'sm:text-right')}>
          <AlertDialogTitle>{t('admins.resetUsersUsage')}</AlertDialogTitle>
          <AlertDialogDescription className="flex items-center gap-2">
            <span dir={dir} dangerouslySetInnerHTML={{ __html: t('resetUsersUsage.prompt', { name: adminUsername }) }} />
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter className={cn(dir === 'rtl' && 'sm:gap-x-2 sm:flex-row-reverse')}>
          <AlertDialogCancel onClick={onClose}>{t('cancel')}</AlertDialogCancel>
          <AlertDialogAction onClick={onConfirm}>{t('confirm')}</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}

export default function AdminsTable({ onEdit, onDelete, onToggleStatus, onResetUsage }: AdminsTableProps) {
  const { t } = useTranslation()
  const [currentPage, setCurrentPage] = useState(0)
  const [itemsPerPage, setItemsPerPage] = useState(20)
  const [filters, setFilters] = useState<AdminFilters>({
    sort: '-created_at',
    limit: 20,
    offset: 0,
    username: null,
  })
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [statusToggleDialogOpen, setStatusToggleDialogOpen] = useState(false)
  const [resetUsersUsageDialogOpen, setResetUsersUsageDialogOpen] = useState(false)
  const [adminToDelete, setAdminToDelete] = useState<AdminDetails | null>(null)
  const [adminToToggleStatus, setAdminToToggleStatus] = useState<AdminDetails | null>(null)
  const [adminToReset, setAdminToReset] = useState<string | null>(null)

  const { data: adminsData, isLoading, isFetching } = useGetAdmins(filters)

  // Update filters when pagination changes
  useEffect(() => {
    setFilters(prev => ({
      ...prev,
      limit: itemsPerPage,
      offset: currentPage * itemsPerPage,
    }))
  }, [currentPage, itemsPerPage])

  // When filters change (e.g., search), reset page if needed
  const handleFilterChange = (newFilters: Partial<AdminFilters>) => {
    setFilters(prev => {
      const resetPage = newFilters.username !== undefined && newFilters.username !== prev.username
      return {
        ...prev,
        ...newFilters,
        offset: resetPage ? 0 : (newFilters.offset !== undefined ? newFilters.offset : prev.offset),
      }
    })
    // Reset page if search changes
    if (newFilters.username !== undefined) {
      setCurrentPage(0)
    }
  }

  const handleDeleteClick = (admin: AdminDetails) => {
    setAdminToDelete(admin)
    setDeleteDialogOpen(true)
  }

  const handleStatusToggleClick = (admin: AdminDetails) => {
    setAdminToToggleStatus(admin)
    setStatusToggleDialogOpen(true)
  }

  const handleResetUsersUsageClick = (adminUsername: string) => {
    setAdminToReset(adminUsername)
    setResetUsersUsageDialogOpen(true)
  }
  const handleConfirmResetUsersUsage = async () => {
    if (adminToReset) {
      onResetUsage(adminToReset)
      setResetUsersUsageDialogOpen(false)
      setAdminToReset(null)
    }
  }
  const handleConfirmDelete = async () => {
    if (adminToDelete) {
      onDelete(adminToDelete)
      setDeleteDialogOpen(false)
      setAdminToDelete(null)
    }
  }

  const handleConfirmStatusToggle = async (clicked: boolean) => {
    if (adminToToggleStatus) {
      onToggleStatus(adminToToggleStatus, clicked)
      setStatusToggleDialogOpen(false)
      setAdminToToggleStatus(null)
    }
  }

  const handleSort = (column: string) => {
    let newSort: string
    if (filters.sort === column) {
      newSort = '-' + column
    } else if (filters.sort === '-' + column) {
      newSort = '-username'
    } else {
      newSort = column
    }
    setFilters(prev => ({ ...prev, sort: newSort }))
  }

  const columns = setupColumns({
    t,
    handleSort,
    filters,
    onEdit,
    onDelete: handleDeleteClick,
    toggleStatus: handleStatusToggleClick,
    onResetUsage: handleResetUsersUsageClick,
  })

  return (
    <div>
      <Filters filters={filters} onFilterChange={handleFilterChange} />
      <DataTable
        columns={columns}
        data={adminsData || []}
        onEdit={onEdit}
        onDelete={handleDeleteClick}
        onToggleStatus={handleStatusToggleClick}
        onResetUsage={handleResetUsersUsageClick}
        setStatusToggleDialogOpen={setStatusToggleDialogOpen}
        isLoading={isLoading}
        isFetching={isFetching}
      />
      <PaginationControls
        currentPage={currentPage}
        itemsPerPage={itemsPerPage}
        setCurrentPage={setCurrentPage}
        setItemsPerPage={setItemsPerPage}
        isLoading={isLoading || isFetching}
        totalItems={adminsData?.length || 0}
      />
      {adminToDelete && <DeleteAlertDialog admin={adminToDelete} isOpen={deleteDialogOpen} onClose={() => setDeleteDialogOpen(false)} onConfirm={handleConfirmDelete} />}
      {adminToToggleStatus && (
        <ToggleAdminStatusModal admin={adminToToggleStatus} isOpen={statusToggleDialogOpen} onClose={() => setStatusToggleDialogOpen(false)} onConfirm={handleConfirmStatusToggle} />
      )}
      {adminToReset && (
        <ResetUsersUsageConfirmationDialog
          adminUsername={adminToReset}
          onConfirm={handleConfirmResetUsersUsage}
          isOpen={resetUsersUsageDialogOpen}
          onClose={() => setResetUsersUsageDialogOpen(false)}
        />
      )}
    </div>
  )
}
